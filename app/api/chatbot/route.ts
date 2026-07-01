import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/api-session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { generateSupportReply, sanitizeSupportPath } from "@/lib/support-chatbot";
import { formatSupportTicketChatReply, upsertSupportTicketFromChat } from "@/lib/support-tickets";

export const dynamic = "force-dynamic";

const maxBodyBytes = 4096;

const chatbotRequestSchema = z.object({
  message: z.string().trim().min(1).max(600),
  path: z.string().trim().max(200).optional().nullable(),
  sessionId: z.string().trim().regex(/^[a-zA-Z0-9_-]{8,80}$/).optional()
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const coarseBucket = await rateLimit(`chatbot:ip:${ip}`, 30, 60_000);

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

  const sessionKey = parsed.data.sessionId ?? "anonymous";
  const sessionBucket = await rateLimit(`chatbot:session:${ip}:${sessionKey}`, 12, 60_000);

  if (!sessionBucket.allowed) {
    return json({ error: "Too many messages. Please wait a minute." }, 429);
  }

  const session = await getSessionUser();
  const path = sanitizeSupportPath(parsed.data.path);
  const reply = generateSupportReply({
    message: parsed.data.message,
    path,
    sessionRole: session?.role ?? null
  });
  let responseReply = reply.reply;
  let supportTicket: Record<string, unknown> | null = null;

  if (reply.escalate && reply.safe) {
    try {
      const ticket = await upsertSupportTicketFromChat({
        message: parsed.data.message,
        path,
        session,
        sessionId: parsed.data.sessionId,
        reply
      });

      if (ticket) {
        responseReply = formatSupportTicketChatReply(reply.reply, ticket);
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
      console.error("Could not persist chatbot support ticket", error);
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
