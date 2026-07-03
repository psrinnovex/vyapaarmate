import { randomBytes } from "node:crypto";
import { Prisma, type SupportTicketPriority, type SupportTicketStatus } from "@prisma/client";
import { autoAssignSupportQueue, getSupportQueuePosition } from "@/lib/support-agent-queue";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import type { SupportChatbotReply } from "@/lib/support-chatbot";
import { sanitizeSupportMessage, supportReplyWordLimit } from "@/lib/support-chatbot";
import { redactChatbotText, shouldStoreRawChatbotMessages, storedChatbotMessageBody } from "@/lib/chatbot/chatbot-redaction";

const activeTicketStatuses: SupportTicketStatus[] = ["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER"];
const priorityRank: Record<SupportTicketPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

type SupportTicketDetails = {
  issue?: string;
  requesterBusinessName?: string;
  requesterPhone?: string;
  orderReference?: string;
  paymentReference?: string;
};

export type ChatSupportTicketResult = {
  id: string;
  code: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedToName: string | null;
  queuePosition: number | null;
  created: boolean;
  intakeComplete: boolean;
};

export async function upsertSupportTicketFromChat(input: {
  message: string;
  sessionId?: string | null;
  path?: string | null;
  session?: SessionUser | null;
  reply: SupportChatbotReply;
}): Promise<ChatSupportTicketResult | null> {
  const rawMessage = sanitizeSupportMessage(input.message);
  if (!rawMessage) return null;

  const message = storedChatbotMessageBody(rawMessage);
  const details = extractSupportTicketDetails(rawMessage);
  const storedDetails = redactSupportTicketDetails(details);
  const priority = priorityForSupportTicket(input.reply.intent, message);
  const now = new Date();
  const businessId = input.session?.businessId ?? null;
  const requesterUserId = input.session?.id ?? null;
  const requesterName = input.session?.name ?? null;
  const requesterEmail = input.session?.email ?? null;
  const subject = subjectForSupportTicket(input.reply.intent, storedDetails, message);
  const safeHandlingNote = safeHandlingNoteForIntent(input.reply.intent);
  const firstResponseDueAt = dueAtForPriority(priority, now);
  const metadata: Prisma.InputJsonObject = {
    chatbotIntent: input.reply.intent,
    chatbotConfidence: input.reply.confidence,
    chatbotPortal: input.reply.portal,
    chatbotSafe: input.reply.safe,
    chatbotEscalate: input.reply.escalate,
    chatbotRawMessageStored: shouldStoreRawChatbotMessages(),
    path: input.path ?? null
  };

  const ticketResult = await prisma.$transaction(async (tx) => {
    const existing = input.sessionId
      ? await tx.supportTicket.findFirst({
          where: {
            sessionId: input.sessionId,
            status: { in: activeTicketStatuses }
          },
          orderBy: { updatedAt: "desc" }
        })
      : null;

    if (existing) {
      const updated = await tx.supportTicket.update({
        where: { id: existing.id },
        data: {
          subject: shouldReplaceSubject(existing.subject) ? subject : existing.subject,
          description: mergeDescription(existing.description, storedDetails.issue ?? message),
          priority: higherPriority(existing.priority, priority),
          lastMessage: message,
          safeHandlingNote,
          firstResponseDueAt: existing.firstResponseDueAt ?? firstResponseDueAt,
          lastMessageAt: now,
          businessId: existing.businessId ?? businessId ?? undefined,
          requesterUserId: existing.requesterUserId ?? requesterUserId ?? undefined,
          requesterName: existing.requesterName ?? requesterName ?? undefined,
          requesterEmail: existing.requesterEmail ?? requesterEmail ?? undefined,
          requesterPhone: existing.requesterPhone ?? details.requesterPhone ?? undefined,
          requesterBusinessName: existing.requesterBusinessName ?? details.requesterBusinessName ?? undefined,
          orderReference: existing.orderReference ?? details.orderReference ?? undefined,
          paymentReference: existing.paymentReference ?? details.paymentReference ?? undefined,
          metadata
        }
      });
      await tx.supportTicketMessage.createMany({
        data: existing.assignedToUserId
          ? [customerMessageForChat(updated.id, message, metadata)]
          : ticketMessagesForChat(updated.id, message, input.reply.reply, metadata)
      });

      return {
        ticketId: updated.id,
        created: false,
        intakeComplete: hasSupportIntakeDetails(details)
      };
    }

    const created = await createSupportTicketWithRetry(tx, {
      subject,
      description: storedDetails.issue ?? message,
      priority,
      status: "OPEN",
      source: "CHATBOT",
      intent: input.reply.intent,
      portal: input.reply.portal,
      sessionId: input.sessionId ?? undefined,
      path: input.path ?? undefined,
      businessId: businessId ?? undefined,
      requesterUserId: requesterUserId ?? undefined,
      requesterName: requesterName ?? undefined,
      requesterEmail: requesterEmail ?? undefined,
      requesterPhone: details.requesterPhone,
      requesterBusinessName: details.requesterBusinessName,
      orderReference: details.orderReference,
      paymentReference: details.paymentReference,
      lastMessage: message,
      safeHandlingNote,
      metadata,
      firstResponseDueAt,
      lastMessageAt: now
    });
    await tx.supportTicketMessage.createMany({
      data: ticketMessagesForChat(created.id, message, input.reply.reply, metadata)
    });

    return {
      ticketId: created.id,
      created: true,
      intakeComplete: hasSupportIntakeDetails(details)
    };
  });

  await autoAssignSupportQueue(null, {
    source: "chatbot",
    reason: "chatbot_support_handoff"
  });

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketResult.ticketId },
    select: {
      id: true,
      code: true,
      status: true,
      priority: true,
      assignedTo: { select: { name: true } }
    }
  });
  if (!ticket) return null;

  return {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status,
    priority: ticket.priority,
    assignedToName: ticket.assignedTo?.name ?? null,
    queuePosition: await getSupportQueuePosition(ticket.id),
    created: ticketResult.created,
    intakeComplete: ticketResult.intakeComplete
  };
}

export function formatSupportTicketChatReply(baseReply: string, ticket: ChatSupportTicketResult) {
  const reply = ticket.assignedToName
    ? `Agent ${ticket.assignedToName} connected to you for ${ticket.code}. Continue here; support replies will appear in this box.`
    : ticket.queuePosition
      ? `Support request ${ticket.code} is in queue position ${ticket.queuePosition}. Continue here; an agent will join when available.`
      : ticket.intakeComplete
        ? `${ticket.created ? "Support request" : "Updated request"} ${ticket.code} with these details. Add phone or order ID if relevant.`
        : ticket.created
          ? `Support request ${ticket.code} opened. ${baseReply}`
          : `Updated request ${ticket.code}. ${baseReply}`;

  const words = reply.trim().split(/\s+/);
  return words.length <= supportReplyWordLimit ? reply : `${words.slice(0, supportReplyWordLimit).join(" ")}.`;
}

export function extractSupportTicketDetails(message: string): SupportTicketDetails {
  const sanitized = sanitizeSupportMessage(message);
  const details: SupportTicketDetails = {};

  details.issue = extractLabeledValue(sanitized, ["issue", "problem", "complaint"]);
  details.requesterBusinessName = extractLabeledValue(sanitized, ["business name", "business"]);
  details.requesterPhone = extractLabeledValue(sanitized, ["phone", "mobile", "contact"]);
  details.orderReference = extractLabeledValue(sanitized, ["order id", "order number", "order no", "order"]);
  details.paymentReference = extractLabeledValue(sanitized, ["payment id", "payment reference", "payment ref", "utr"]);

  if (!details.requesterPhone) {
    details.requesterPhone = sanitized.match(/(?:\+91[\s-]?)?[6-9]\d{9}\b/)?.[0];
  }

  if (!details.paymentReference) {
    details.paymentReference = sanitized.match(/\b(?:utr|upi|cf|pay)[\s:#-]*([a-z0-9-]{6,32})\b/i)?.[1];
  }

  return compactDetails(details);
}

function createSupportTicketWithRetry(
  tx: Prisma.TransactionClient,
  data: Omit<Prisma.SupportTicketUncheckedCreateInput, "id" | "code" | "createdAt" | "updatedAt">
) {
  return retryUniqueCode((code) => tx.supportTicket.create({ data: { ...data, code } }));
}

async function retryUniqueCode<T>(create: (code: string) => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await create(generateSupportTicketCode());
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not allocate support ticket code.");
}

function generateSupportTicketCode() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `SUP-${datePart}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function ticketMessagesForChat(ticketId: string, message: string, botReply: string, metadata: Prisma.InputJsonObject) {
  return [
    customerMessageForChat(ticketId, message, metadata),
    {
      ticketId,
      sender: "BOT" as const,
      body: redactChatbotText(botReply),
      metadata
    }
  ];
}

function customerMessageForChat(ticketId: string, message: string, metadata: Prisma.InputJsonObject) {
  return {
    ticketId,
    sender: "CUSTOMER" as const,
    body: message,
    metadata
  };
}

function extractLabeledValue(message: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`\\b${escapeRegExp(label)}\\s*[:=-]\\s*([^,;\\n]{2,120})`, "i");
    const value = pattern.exec(message)?.[1]?.trim();
    if (value) return value.replace(/\s+/g, " ").slice(0, 120);
  }
  return undefined;
}

function compactDetails(details: SupportTicketDetails): SupportTicketDetails {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => Boolean(value))) as SupportTicketDetails;
}

function redactSupportTicketDetails(details: SupportTicketDetails): SupportTicketDetails {
  return compactDetails({
    issue: details.issue ? redactChatbotText(details.issue) : undefined,
    requesterBusinessName: details.requesterBusinessName ? redactChatbotText(details.requesterBusinessName) : undefined,
    requesterPhone: details.requesterPhone ? redactChatbotText(details.requesterPhone) : undefined,
    orderReference: details.orderReference ? redactChatbotText(details.orderReference) : undefined,
    paymentReference: details.paymentReference ? redactChatbotText(details.paymentReference) : undefined
  });
}

function hasSupportIntakeDetails(details: SupportTicketDetails) {
  return Boolean(details.issue && (details.requesterBusinessName || details.requesterPhone || details.orderReference || details.paymentReference));
}

function priorityForSupportTicket(intent: string, message: string): SupportTicketPriority {
  const normalized = message.toLowerCase();
  if (intent === "security" || normalized.includes("breach") || normalized.includes("secret") || normalized.includes("otp")) return "HIGH";
  if (intent === "refund" || intent === "payments" || intent === "payouts") return "HIGH";
  if (/\b(urgent|broken|not working|failed|duplicate|missing|complaint)\b/i.test(message)) return "HIGH";
  if (intent === "whatsapp" || intent === "account" || intent === "businesses" || intent === "handoff") return "MEDIUM";
  return "LOW";
}

function dueAtForPriority(priority: SupportTicketPriority, from: Date) {
  const minutes = priority === "HIGH" ? 15 : priority === "MEDIUM" ? 4 * 60 : 24 * 60;
  return new Date(from.getTime() + minutes * 60_000);
}

function higherPriority(left: SupportTicketPriority, right: SupportTicketPriority): SupportTicketPriority {
  return priorityRank[right] > priorityRank[left] ? right : left;
}

function shouldReplaceSubject(subject: string) {
  return /^Agent support\b/i.test(subject) || /^Support request\b/i.test(subject);
}

function subjectForSupportTicket(intent: string, details: SupportTicketDetails, message: string) {
  const issue = details.issue ?? message;
  const clippedIssue = issue.replace(/\s+/g, " ").trim().slice(0, 70);
  if (clippedIssue && !/^human$/i.test(clippedIssue)) return clippedIssue;
  return intent === "handoff" ? "Agent support requested" : `Support request: ${intent}`;
}

function mergeDescription(existing: string, next: string) {
  if (!next || existing.includes(next)) return existing;
  return `${existing}\n\n${next}`.slice(0, 4000);
}

function safeHandlingNoteForIntent(intent: string) {
  if (intent === "payments" || intent === "refund" || intent === "payouts") {
    return "Ask for order ID, UTR, provider reference, and business name only. Never request UPI PIN, OTP, full card, or full bank details.";
  }
  if (intent === "security") {
    return "Move sensitive investigation to verified admin channels. Do not expose secrets, OTPs, tokens, or private customer data in chat.";
  }
  if (intent === "whatsapp") {
    return "Verify WABA ownership, phone number ID, template status, and consent before enabling or changing WhatsApp sends.";
  }
  if (intent === "account" || intent === "businesses") {
    return "Verify the requester and business record before account or approval changes. Never ask for passwords or OTPs.";
  }
  return "Use safe identifiers only: issue, business name, phone, order ID, UTR, and page name. Do not request secrets.";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
