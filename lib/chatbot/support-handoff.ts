import type { SupportChatbotReply } from "@/lib/support-chatbot";
import type { SessionUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { upsertSupportTicketFromChat } from "@/lib/support-tickets";
import type { ChatbotSecurityContext } from "@/lib/chatbot/chatbot-context";
import { contextRateLimitKey } from "@/lib/chatbot/chatbot-context";
import { chatbotLimits, chatbotToolRefusal, isChatbotToolAllowed } from "@/lib/chatbot/chatbot-policy";
import { writeChatbotAuditLog } from "@/lib/chatbot/chatbot-audit";

export async function requestSupportHandoff(input: {
  message: string;
  path?: string | null;
  sessionId?: string | null;
  session?: SessionUser | null;
  reply: SupportChatbotReply;
  context: ChatbotSecurityContext;
}) {
  if (!isChatbotToolAllowed(input.context.mode, "requestSupportHandoff")) {
    await writeChatbotAuditLog({
      context: input.context,
      action: "CHATBOT_SUPPORT_HANDOFF_BLOCKED",
      metadata: { reason: "tool_not_allowed", intent: input.reply.intent }
    });
    throw new Error(chatbotToolRefusal("requestSupportHandoff"));
  }

  const bucket = await rateLimit(
    `chatbot:handoff:${contextRateLimitKey(input.context)}`,
    chatbotLimits.handoffsPerTenMinutes,
    10 * 60_000
  );

  if (!bucket.allowed) {
    await writeChatbotAuditLog({
      context: input.context,
      action: "CHATBOT_SUPPORT_HANDOFF_RATE_LIMITED",
      metadata: { intent: input.reply.intent, resetAt: new Date(bucket.resetAt).toISOString() }
    });
    throw new Error("Too many support handoff attempts. Please wait before trying again.");
  }

  const ticket = await upsertSupportTicketFromChat({
    message: input.message,
    path: input.path,
    session: input.session,
    sessionId: input.sessionId,
    reply: input.reply
  });

  await writeChatbotAuditLog({
    context: input.context,
    action: "CHATBOT_SUPPORT_HANDOFF_REQUESTED",
    entity: "SupportTicket",
    entityId: ticket?.id ?? null,
    metadata: {
      ticketCode: ticket?.code ?? null,
      intent: input.reply.intent,
      portal: input.reply.portal,
      assignedToName: ticket?.assignedToName ?? null,
      queuePosition: ticket?.queuePosition ?? null
    }
  });

  return ticket;
}
