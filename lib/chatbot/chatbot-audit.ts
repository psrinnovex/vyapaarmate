import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type { ChatbotSecurityContext } from "@/lib/chatbot/chatbot-context";
import { redactChatbotMetadata } from "@/lib/chatbot/chatbot-redaction";
import { safeLog } from "@/lib/security/safe-logger";

export async function writeChatbotAuditLog(input: {
  context: ChatbotSecurityContext;
  action: string;
  entity?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await writeAuditLog({
      userId: input.context.userId,
      businessId: input.context.businessId,
      action: input.action,
      entity: input.entity ?? "Chatbot",
      entityId: input.entityId ?? undefined,
      metadata: redactChatbotMetadata({
        mode: input.context.mode,
        role: input.context.role,
        path: input.context.path,
        sessionId: input.context.sessionId,
        ...input.metadata
      }) as Prisma.InputJsonObject
    });
  } catch (error) {
    safeLog("error", "Chatbot audit log write failed", { error, action: input.action });
  }
}
