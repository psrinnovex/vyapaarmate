import { NextResponse } from "next/server";
import type { SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import { getSupportSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { storedChatbotMessageBody } from "@/lib/chatbot/chatbot-redaction";
import { prisma } from "@/lib/prisma";
import { assignSupportTicketToAgent, autoAssignSupportQueue, SupportAgentBusyError } from "@/lib/support-agent-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

const supportTicketMessageSchema = z.object({
  body: z.string().trim().min(2).max(1200),
  status: z.enum(["IN_REVIEW", "WAITING_ON_CUSTOMER", "RESOLVED"]).optional()
});

type AgentReplyStatus = NonNullable<z.infer<typeof supportTicketMessageSchema>["status"]>;

export async function POST(request: Request, context: RouteContext) {
  const session = await getSupportSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = supportTicketMessageSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { ticketId } = await context.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId }
  });

  if (!ticket) return NextResponse.json({ error: "Support ticket not found" }, { status: 404 });
  if (ticket.status === "CLOSED") return NextResponse.json({ error: "Closed tickets cannot receive replies." }, { status: 409 });
  if (ticket.assignedToUserId && ticket.assignedToUserId !== session.id && session.role === "SUPPORT_AGENT") {
    return NextResponse.json({ error: "This chat is assigned to another agent." }, { status: 409 });
  }

  if (!ticket.assignedToUserId) {
    try {
      await assignSupportTicketToAgent(ticket.id, session.id, session.id, {
        source: session.role === "SUPER_ADMIN" ? "admin" : "manual",
        reason: "agent_reply_claim"
      });
    } catch (error) {
      if (error instanceof SupportAgentBusyError) return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
  }

  const now = new Date();
  const nextStatus = statusAfterAgentReply(ticket.status, parsed.data.status);
  const body = storedChatbotMessageBody(parsed.data.body);
  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: "AGENT",
        body,
        authorUserId: session.id
      }
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        assignedToUserId: ticket.assignedToUserId ?? session.id,
        assignedAt: ticket.assignedToUserId ? ticket.assignedAt : now,
        lastMessage: body,
        lastMessageAt: now,
        resolvedAt: nextStatus === "RESOLVED" ? (ticket.resolvedAt ?? now) : null
      }
    })
  ]);

  if (nextStatus === "RESOLVED") {
    await autoAssignSupportQueue(ticket.assignedToUserId ?? session.id, {
      source: "system",
      reason: "ticket_resolved_queue_rotation"
    });
    await autoAssignSupportQueue(null, {
      source: "system",
      reason: "ticket_resolved_queue_rotation"
    });
  }

  await writeAuditLog({
    userId: session.id,
    businessId: ticket.businessId,
    action: "SUPPORT_TICKET_AGENT_REPLY",
    entity: "SupportTicket",
    entityId: ticket.id,
    metadata: {
      code: ticket.code,
      status: nextStatus,
      delivery: "chat"
    }
  });

  return NextResponse.json({ added: true, delivery: "chat" });
}

function statusAfterAgentReply(currentStatus: SupportTicketStatus, requestedStatus?: AgentReplyStatus): AgentReplyStatus {
  if (requestedStatus) return requestedStatus;
  return currentStatus === "RESOLVED" ? "RESOLVED" : "WAITING_ON_CUSTOMER";
}
