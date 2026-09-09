import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupportSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { canPatchSupportTicket } from "@/lib/security/authz";
import { parseJsonRequest } from "@/lib/security/validation";
import { assignSupportTicketToAgent, autoAssignSupportQueue, SupportAgentBusyError } from "@/lib/support-agent-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

const supportTicketPatchSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedToUserId: z.string().trim().min(1).nullable().optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSupportSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await parseJsonRequest(request, supportTicketPatchSchema);
  if (parsed.response) return parsed.response;

  const { ticketId } = await context.params;
  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, code: true, businessId: true, assignedToUserId: true }
  });

  if (!existing) return NextResponse.json({ error: "Support ticket not found" }, { status: 404 });
  if (!canPatchSupportTicket(session, existing.assignedToUserId, parsed.data.assignedToUserId)) {
    return NextResponse.json({ error: "You can only update support tickets assigned to you." }, { status: 403 });
  }

  if (parsed.data.assignedToUserId) {
    const agent = await prisma.user.findFirst({
      where: { id: parsed.data.assignedToUserId, role: { in: ["SUPER_ADMIN", "SUPPORT_AGENT"] } },
      select: { id: true }
    });
    if (!agent) return NextResponse.json({ error: "Selected agent was not found." }, { status: 400 });
  }

  const now = new Date();
  const updateData = {
    ...(parsed.data.status ? {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED" ? now : null
    } : {}),
    ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
    ...(parsed.data.assignedToUserId === null ? {
      assignedToUserId: null,
      assignedAt: null,
      status: parsed.data.status ?? "OPEN"
    } : {})
  };

  try {
    if (parsed.data.assignedToUserId && parsed.data.assignedToUserId !== existing.assignedToUserId) {
      const assignment = await assignSupportTicketToAgent(existing.id, parsed.data.assignedToUserId, session.id, {
        source: session.role === "SUPER_ADMIN" ? "admin" : "manual",
        reason: "support_ticket_patch",
        ...(session.role === "SUPPORT_AGENT"
          ? { expectedAssignedToUserId: existing.assignedToUserId }
          : {})
      });
      if (!assignment) {
        return NextResponse.json({ error: "This support ticket assignment changed. Refresh and try again." }, { status: 409 });
      }
    }
  } catch (error) {
    if (error instanceof SupportAgentBusyError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }

  if (Object.keys(updateData).length > 0) {
    if (session.role === "SUPPORT_AGENT") {
      const expectedAssignedToUserId = parsed.data.assignedToUserId === session.id
        ? session.id
        : existing.assignedToUserId;
      const updated = await prisma.supportTicket.updateMany({
        where: { id: existing.id, assignedToUserId: expectedAssignedToUserId },
        data: updateData
      });
      if (updated.count !== 1) {
        return NextResponse.json({ error: "This support ticket assignment changed. Refresh and try again." }, { status: 409 });
      }
    } else {
      await prisma.supportTicket.update({
        where: { id: existing.id },
        data: updateData
      });
    }
  }

  if (parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED") {
    await autoAssignSupportQueue(existing.assignedToUserId, {
      source: "system",
      reason: "ticket_closed_queue_rotation"
    });
    await autoAssignSupportQueue(null, {
      source: "system",
      reason: "ticket_closed_queue_rotation"
    });
  } else if (parsed.data.assignedToUserId === null) {
    await autoAssignSupportQueue(null, existing.assignedToUserId ? {
      source: "system",
      reason: "ticket_unassigned_queue_rotation",
      skipTicketIdsByAgentId: {
        [existing.assignedToUserId]: [existing.id]
      }
    } : undefined);
  }

  const updated = await prisma.supportTicket.findUniqueOrThrow({
    where: { id: existing.id },
    select: { id: true, code: true, status: true, priority: true, assignedToUserId: true }
  });

  await writeAuditLog({
    userId: session.id,
    businessId: existing.businessId,
    action: "SUPPORT_TICKET_UPDATED",
    entity: "SupportTicket",
    entityId: existing.id,
    metadata: {
      code: existing.code,
      status: updated.status,
      priority: updated.priority,
      assignedToUserId: updated.assignedToUserId
    }
  });

  if (parsed.data.assignedToUserId === null && existing.assignedToUserId) {
    await writeAuditLog({
      userId: session.id,
      businessId: existing.businessId,
      action: "SUPPORT_TICKET_UNASSIGNED",
      entity: "SupportTicket",
      entityId: existing.id,
      metadata: {
        ticketId: existing.id,
        code: existing.code,
        businessId: existing.businessId,
        assignedAgentId: existing.assignedToUserId,
        assignedBy: session.id,
        reason: "manual_unassignment",
        timestamp: new Date().toISOString(),
        source: session.role === "SUPER_ADMIN" ? "admin" : "manual"
      }
    });
  }

  return NextResponse.json({ updated: true, ticketId: updated.id, code: updated.code });
}
