import { NextResponse } from "next/server";
import { type Prisma, type SupportTicketStatus } from "@prisma/client";
import { getSupportSession } from "@/lib/api-session";
import { liveStream } from "@/lib/live-data";
import type { LiveChangePayload } from "@/lib/postgres-live-events";
import { prisma } from "@/lib/prisma";
import { emptySupportAgentRatingStats, getSupportAgentRatingStats } from "@/lib/support-agent-ratings";

export const dynamic = "force-dynamic";

const activeStatuses: SupportTicketStatus[] = ["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER"];

const supportTicketInclude = {
  business: { select: { id: true, name: true, phone: true, email: true } },
  requester: { select: { id: true, name: true, email: true, phone: true, role: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    take: 60,
    include: { author: { select: { id: true, name: true, email: true } } }
  },
  _count: { select: { messages: true } }
};

export async function GET(request: Request) {
  const session = await getSupportSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";
  const payload = () => getSupportPayload(url);

  if (!stream) return NextResponse.json(await payload());

  return new Response(
    liveStream("support", payload, request.signal, {
      sendInitialPayload: !skipInitial,
      changeFilter: supportChangeMatches
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    }
  );
}

async function getSupportPayload(url: URL) {
  const includeClosed = url.searchParams.get("includeClosed") === "1";
  const status = url.searchParams.get("status");
  const where: Prisma.SupportTicketWhereInput = {};

  if (status && isSupportTicketStatus(status)) {
    where.status = status;
  } else if (!includeClosed) {
    where.status = { not: "CLOSED" };
  }

  const [tickets, agents] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [
        { lastMessageAt: "desc" },
        { priority: "desc" }
      ],
      take: 100,
      include: supportTicketInclude
    }),
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "SUPPORT_AGENT"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    })
  ]);

  const agentRatingStats = await getSupportAgentRatingStats(agents.map((agent) => agent.id));
  const now = Date.now();
  return {
    tickets: tickets.map((ticket) => serializeSupportTicket(ticket, now)),
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      role: agent.role,
      createdAt: agent.createdAt.toISOString(),
      rating: agentRatingStats.get(agent.id) ?? emptySupportAgentRatingStats()
    })),
    metrics: {
      total: tickets.length,
      open: tickets.filter((ticket) => activeStatuses.includes(ticket.status)).length,
      highPriority: tickets.filter((ticket) => ticket.priority === "HIGH" && activeStatuses.includes(ticket.status)).length,
      waiting: tickets.filter((ticket) => ticket.status === "WAITING_ON_CUSTOMER").length,
      overdue: tickets.filter((ticket) => activeStatuses.includes(ticket.status) && ticket.firstResponseDueAt && ticket.firstResponseDueAt.getTime() < now).length
    }
  };
}

function supportChangeMatches(change: LiveChangePayload) {
  return ["Business", "SupportTicket", "SupportTicketMessage", "User"].includes(change.table);
}

type SupportTicketForPayload = Prisma.SupportTicketGetPayload<{ include: typeof supportTicketInclude }>;

function serializeSupportTicket(ticket: SupportTicketForPayload, now = Date.now()) {
  const active = activeStatuses.includes(ticket.status);
  const dueAt = ticket.firstResponseDueAt?.toISOString() ?? null;
  return {
    id: ticket.id,
    code: ticket.code,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    source: ticket.source,
    intent: ticket.intent,
    portal: ticket.portal,
    path: ticket.path,
    businessId: ticket.businessId,
    businessName: ticket.business?.name ?? ticket.requesterBusinessName ?? "Unknown business",
    businessPhone: ticket.business?.phone ?? null,
    businessEmail: ticket.business?.email ?? null,
    requesterName: ticket.requester?.name ?? ticket.requesterName,
    requesterEmail: ticket.requester?.email ?? ticket.requesterEmail,
    requesterPhone: ticket.requester?.phone ?? ticket.requesterPhone,
    requesterBusinessName: ticket.requesterBusinessName,
    orderReference: ticket.orderReference,
    paymentReference: ticket.paymentReference,
    assignedToUserId: ticket.assignedToUserId,
    assignedToName: ticket.assignedTo?.name ?? null,
    feedback: readSupportFeedback(ticket.metadata),
    lastMessage: ticket.lastMessage,
    safeHandlingNote: ticket.safeHandlingNote,
    firstResponseDueAt: dueAt,
    slaLabel: slaLabel(ticket.firstResponseDueAt, now),
    isOverdue: Boolean(active && ticket.firstResponseDueAt && ticket.firstResponseDueAt.getTime() < now),
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    assignedAt: ticket.assignedAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messageCount: ticket._count.messages,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      body: message.body,
      authorName: message.author?.name ?? null,
      authorEmail: message.author?.email ?? null,
      createdAt: message.createdAt.toISOString()
    }))
  };
}

function readSupportFeedback(metadata: Prisma.JsonValue) {
  const root = jsonObject(metadata);
  const feedback = jsonObject(root?.agentFeedback);
  if (!feedback || typeof feedback.rating !== "number" || typeof feedback.submittedAt !== "string") return null;
  return {
    rating: feedback.rating,
    comment: typeof feedback.comment === "string" ? feedback.comment : null,
    submittedAt: feedback.submittedAt
  };
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isSupportTicketStatus(value: string): value is SupportTicketStatus {
  return ["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"].includes(value);
}

function slaLabel(dueAt: Date | null, now: number) {
  if (!dueAt) return "No SLA";
  const diffMinutes = Math.round((dueAt.getTime() - now) / 60_000);
  const prefix = diffMinutes < 0 ? "Overdue " : "";
  const absolute = Math.abs(diffMinutes);
  if (absolute < 60) return `${prefix}${absolute} min`;
  if (absolute < 24 * 60) return `${prefix}${Math.round(absolute / 60)} hr`;
  return `${prefix}${Math.round(absolute / (24 * 60))} day`;
}
