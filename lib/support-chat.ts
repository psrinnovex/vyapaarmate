import { Prisma, type SupportTicketStatus } from "@prisma/client";
import { autoAssignSupportQueue, getSupportQueuePosition } from "@/lib/support-agent-queue";
import type { LiveChangePayload } from "@/lib/postgres-live-events";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { storedChatbotMessageBody } from "@/lib/chatbot/chatbot-redaction";
import { sanitizeSupportMessage } from "@/lib/support-chatbot";
import { initials } from "@/lib/utils";

export const supportChatInclude = {
  business: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, email: true, role: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    take: 120,
    include: { author: { select: { id: true, name: true, email: true } } }
  }
};

export type SupportChatTicket = Prisma.SupportTicketGetPayload<{ include: typeof supportChatInclude }>;

export class SupportChatAuthError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "SupportChatAuthError";
  }
}

export class SupportChatClosedError extends Error {
  constructor() {
    super("This support chat is already closed.");
    this.name = "SupportChatClosedError";
  }
}

export async function getSupportChatPayload(input: {
  ticketId: string;
  sessionId?: string | null;
  session?: SessionUser | null;
}) {
  await autoAssignSupportQueue(null, {
    source: "system",
    reason: "support_chat_payload_queue_assignment"
  });

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    include: supportChatInclude
  });
  if (!ticket) return null;
  if (!canAccessSupportChat(ticket, input)) throw new SupportChatAuthError();

  const queuePosition = await getSupportQueuePosition(ticket.id);
  return { ticket: serializeSupportChatTicket(ticket, queuePosition) };
}

export async function createCustomerSupportMessage(input: {
  ticketId: string;
  body: string;
  sessionId?: string | null;
  session?: SessionUser | null;
}) {
  const sanitizedBody = sanitizeSupportMessage(input.body);
  if (!sanitizedBody) return null;
  const body = storedChatbotMessageBody(sanitizedBody);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    include: supportChatInclude
  });
  if (!ticket) return null;
  if (!canAccessSupportChat(ticket, input)) throw new SupportChatAuthError();
  if (isClosedSupportChat(ticket.status)) throw new SupportChatClosedError();

  const now = new Date();
  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: "CUSTOMER",
        body,
        authorUserId: input.session?.id ?? undefined
      }
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.assignedToUserId ? "IN_REVIEW" : "OPEN",
        lastMessage: body,
        lastMessageAt: now
      }
    })
  ]);

  await autoAssignSupportQueue(null, {
    source: "system",
    reason: "customer_support_message_queue_assignment"
  });
  return getSupportChatPayload(input);
}

export async function submitSupportChatFeedback(input: {
  ticketId: string;
  rating: number;
  comment?: string | null;
  sessionId?: string | null;
  session?: SessionUser | null;
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    include: supportChatInclude
  });
  if (!ticket) return null;
  if (!canAccessSupportChat(ticket, input)) throw new SupportChatAuthError();
  if (!isClosedSupportChat(ticket.status)) throw new SupportChatClosedError();

  const feedback = {
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    comment: storedChatbotMessageBody(sanitizeSupportMessage(input.comment ?? "").slice(0, 500)) || null,
    submittedAt: new Date().toISOString()
  };
  const metadata = mergeMetadata(ticket.metadata, { agentFeedback: feedback });

  await prisma.$transaction([
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { metadata }
    }),
    prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: "SYSTEM",
        body: `Feedback received: ${feedback.rating}/5.`,
        metadata: { agentFeedback: feedback }
      }
    })
  ]);

  return getSupportChatPayload(input);
}

export function supportChatChangeMatches(ticketId: string, change: LiveChangePayload) {
  if (change.table === "SupportTicket" || change.table === "SupportTicketMessage") {
    return change.ticketId === ticketId;
  }
  if (change.table === "User") return true;
  return false;
}

export function serializeSupportChatTicket(ticket: SupportChatTicket, queuePosition: number | null = null) {
  const feedback = readAgentFeedback(ticket.metadata);

  return {
    id: ticket.id,
    code: ticket.code,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    queuePosition,
    assignedToUserId: ticket.assignedToUserId,
    assignedToName: ticket.assignedTo?.name ?? null,
    assignedToInitials: ticket.assignedTo ? initials(ticket.assignedTo.name) : null,
    businessName: ticket.business?.name ?? ticket.requesterBusinessName ?? null,
    requesterName: ticket.requester?.name ?? ticket.requesterName,
    feedback,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: ticket.messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      body: message.body,
      authorName: message.author?.name ?? null,
      authorInitials: message.author ? initials(message.author.name) : null,
      createdAt: message.createdAt.toISOString()
    }))
  };
}

function canAccessSupportChat(ticket: SupportChatTicket, input: { sessionId?: string | null; session?: SessionUser | null }) {
  if (input.sessionId && ticket.sessionId === input.sessionId) return true;
  if (!input.session) return false;
  if (ticket.requesterUserId && ticket.requesterUserId === input.session.id) return true;
  if (ticket.businessId && ticket.businessId === input.session.businessId && input.session.role !== "CUSTOMER") return true;
  return false;
}

function isClosedSupportChat(status: SupportTicketStatus) {
  return status === "RESOLVED" || status === "CLOSED";
}

function readAgentFeedback(metadata: Prisma.JsonValue) {
  const value = jsonObject(metadata)?.agentFeedback;
  const feedback = jsonObject(value);
  if (!feedback || typeof feedback.rating !== "number" || typeof feedback.submittedAt !== "string") return null;

  return {
    rating: feedback.rating,
    comment: typeof feedback.comment === "string" ? feedback.comment : null,
    submittedAt: feedback.submittedAt
  };
}

function mergeMetadata(metadata: Prisma.JsonValue, patch: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return { ...((jsonObject(metadata) ?? {}) as Prisma.InputJsonObject), ...patch };
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
