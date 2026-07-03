import type { SessionUser } from "@/lib/session";
import { chatbotModeForSession, type ChatbotMode } from "@/lib/chatbot/chatbot-policy";
import { sanitizeSupportPath } from "@/lib/support-chatbot";

export type ChatbotSecurityContext = {
  mode: ChatbotMode;
  userId: string | null;
  userName: string | null;
  role: SessionUser["role"] | null;
  businessId: string | null;
  path: string | null;
  sessionId: string | null;
  ip: string;
  authenticated: boolean;
};

export function buildChatbotContext(input: {
  session?: SessionUser | null;
  path?: string | null;
  sessionId?: string | null;
  ip: string;
}): ChatbotSecurityContext {
  const session = input.session ?? null;

  return {
    mode: chatbotModeForSession(session),
    userId: session?.id ?? null,
    userName: session?.name ?? null,
    role: session?.role ?? null,
    businessId: session?.businessId ?? null,
    path: sanitizeSupportPath(input.path),
    sessionId: input.sessionId ?? null,
    ip: input.ip,
    authenticated: Boolean(session)
  };
}

export function contextRateLimitKey(context: Pick<ChatbotSecurityContext, "userId" | "sessionId" | "ip">) {
  return context.userId
    ? `user:${context.userId}`
    : context.sessionId
      ? `session:${context.ip}:${context.sessionId}`
      : `ip:${context.ip}`;
}
