import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/api-session";
import { buildChatbotContext, contextRateLimitKey } from "@/lib/chatbot/chatbot-context";
import { analyzeChatbotSafety, filterChatbotReply } from "@/lib/chatbot/chatbot-guardrails";
import { chatbotIntentRefusal, chatbotLimits, isChatbotIntentAllowed } from "@/lib/chatbot/chatbot-policy";
import { writeChatbotAuditLog } from "@/lib/chatbot/chatbot-audit";
import { requestSupportHandoff } from "@/lib/chatbot/support-handoff";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { generateSupportReply, resolveSupportPortal, sanitizeSupportPath } from "@/lib/support-chatbot";
import { formatSupportTicketChatReply } from "@/lib/support-tickets";
import { safeLog } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";

const maxBodyBytes = chatbotLimits.maxRequestBodyBytes;

const chatbotRequestSchema = z.object({
  message: z.string().trim().min(1).max(chatbotLimits.maxMessageLength),
  path: z.string().trim().max(200).optional().nullable(),
  sessionId: z.string().trim().regex(/^[a-zA-Z0-9_-]{8,80}$/).optional()
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const coarseBucket = await rateLimit(`chatbot:ip:${ip}`, chatbotLimits.publicIpMessagesPerMinute, 60_000);

  if (!coarseBucket.allowed) {
    return json({ error: "Too many chat requests. Try again shortly." }, 429);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return json({ error: "Message is too large." }, 413);
  }

  const rawBody = await request.text();
  if (rawBody.length > maxBodyBytes) {
    return json({ error: "Message is too large." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid chat request." }, 400);
  }

  const parsed = chatbotRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Send a short support question." }, 400);
  }

  const session = await getSessionUser();
  const path = sanitizeSupportPath(parsed.data.path);
  const context = buildChatbotContext({
    session,
    path,
    sessionId: parsed.data.sessionId ?? null,
    ip
  });

  const sessionBucket = await rateLimit(
    `chatbot:session:${contextRateLimitKey(context)}`,
    context.authenticated ? chatbotLimits.authenticatedMessagesPerMinute : chatbotLimits.sessionMessagesPerMinute,
    60_000
  );

  if (!sessionBucket.allowed) {
    return json({ error: "Too many messages. Please wait a minute." }, 429);
  }

  const safety = analyzeChatbotSafety(parsed.data.message);
  const portal = resolveSupportPortal(path, session?.role ?? null);

  if (!safety.safe) {
    await writeChatbotAuditLog({
      context,
      action: safety.auditEvent ?? "CHATBOT_UNSAFE_REQUEST_BLOCKED",
      metadata: {
        category: safety.category,
        reason: safety.reason,
        message: parsed.data.message
      }
    });

    return json({
      reply: safety.refusal,
      intent: "guardrail",
      portal,
      confidence: "high",
      escalate: false,
      safe: false,
      actions: [],
      supportTicket: null
    });
  }

  const reply = generateSupportReply({
    message: parsed.data.message,
    path,
    sessionRole: session?.role ?? null
  });
  let responseReply = filterChatbotReply(reply.reply);
  let supportTicket: Record<string, unknown> | null = null;

  if (!isChatbotIntentAllowed({ mode: context.mode, role: context.role, intent: reply.intent })) {
    await writeChatbotAuditLog({
      context,
      action: "CHATBOT_INTENT_BLOCKED",
      metadata: {
        intent: reply.intent,
        mode: context.mode,
        role: context.role
      }
    });

    return json({
      reply: chatbotIntentRefusal(reply.intent, context.mode),
      intent: "guardrail",
      portal: reply.portal,
      confidence: "high",
      escalate: false,
      safe: false,
      actions: [],
      supportTicket: null
    });
  }

  if (reply.escalate && reply.safe) {
    try {
      const ticket = await requestSupportHandoff({
        message: parsed.data.message,
        path,
        session,
        sessionId: parsed.data.sessionId,
        reply,
        context
      });

      if (ticket) {
        responseReply = filterChatbotReply(formatSupportTicketChatReply(reply.reply, ticket));
        supportTicket = {
          id: ticket.id,
          code: ticket.code,
          status: ticket.status,
          priority: ticket.priority,
          assignedToName: ticket.assignedToName,
          queuePosition: ticket.queuePosition,
          created: ticket.created
        };
      }
    } catch (error) {
      safeLog("error", "Could not persist chatbot support ticket", { error });
      responseReply = error instanceof Error && /^(Too many|This chatbot tool|That data)/i.test(error.message)
        ? error.message
        : "I could not open a support request safely. Please try again or email support.";
    }
  }

  return json({
    reply: responseReply,
    intent: reply.intent,
    portal: reply.portal,
    confidence: reply.confidence,
    escalate: reply.escalate,
    safe: reply.safe,
    actions: reply.actions,
    supportTicket
  });
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
