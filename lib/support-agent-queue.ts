import { Prisma, type Role, type SupportTicketPriority, type SupportTicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;
export type SupportAssignmentSource = "chatbot" | "manual" | "admin" | "system";
type AutoAssignSupportQueueOptions = {
  skipTicketIdsByAgentId?: Record<string, string[]>;
  source?: SupportAssignmentSource;
  assignedByUserId?: string | null;
  reason?: string;
};

const agentRoles: Role[] = ["SUPPORT_AGENT", "SUPER_ADMIN"];
const agentRoleRank: Record<Role, number> = {
  SUPPORT_AGENT: 0,
  SUPER_ADMIN: 1,
  OWNER: 2,
  CUSTOMER: 2,
  MANAGER: 2,
  KITCHEN_STAFF: 2,
  DELIVERY_STAFF: 2
};
const activeConversationStatuses: SupportTicketStatus[] = ["IN_REVIEW", "WAITING_ON_CUSTOMER"];
const priorityRank: Record<SupportTicketPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export class SupportAgentBusyError extends Error {
  constructor(agentName: string) {
    super(`${agentName} is already assigned to an active chat.`);
    this.name = "SupportAgentBusyError";
  }
}

export type SupportAssignment = {
  ticketId: string;
  agentId: string;
  agentName: string;
};

export async function autoAssignSupportQueue(preferredAgentId?: string | null, options: AutoAssignSupportQueueOptions = {}) {
  const agents = await prisma.user.findMany({
    where: preferredAgentId
      ? { id: preferredAgentId, role: { in: agentRoles } }
      : { role: { in: agentRoles } },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, role: true }
  });
  const sortedAgents = [...agents].sort((left, right) => agentRoleRank[left.role] - agentRoleRank[right.role] || left.name.localeCompare(right.name));
  const assignments: SupportAssignment[] = [];

  for (const agent of sortedAgents) {
    const busy = await supportAgentHasActiveTicket(prisma, agent.id);
    if (busy) continue;

    const ticket = await findNextQueuedTicket(prisma, options.skipTicketIdsByAgentId?.[agent.id] ?? []);
    if (!ticket) break;

    const assignment = await claimQueuedTicket(ticket.id, agent.id, options);
    if (assignment) assignments.push(assignment);
  }

  return assignments;
}

export async function assignSupportTicketToAgent(
  ticketId: string,
  agentId: string,
  assignedByUserId?: string | null,
  options: { source?: SupportAssignmentSource; reason?: string } = {}
) {
  return prisma.$transaction(async (tx) => {
    const [ticket, agent] = await Promise.all([
      tx.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, code: true, businessId: true, status: true, assignedToUserId: true, assignedAt: true }
      }),
      tx.user.findFirst({
        where: { id: agentId, role: { in: agentRoles } },
        select: { id: true, name: true }
      })
    ]);

    if (!ticket || !agent) return null;
    const busy = await supportAgentHasActiveTicket(tx, agent.id, ticket.id);
    if (busy) throw new SupportAgentBusyError(agent.name);

    const now = new Date();
    const changedAgent = ticket.assignedToUserId !== agent.id;
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        assignedToUserId: agent.id,
        assignedAt: changedAgent ? now : ticket.assignedAt,
        status: ticket.status === "OPEN" ? "IN_REVIEW" : ticket.status
      }
    });

    if (changedAgent) {
      await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: "SYSTEM",
          body: `Agent ${agent.name} connected to you.`,
          metadata: {
            assignment: options.source ?? "manual",
            agentId: agent.id,
            assignedByUserId: assignedByUserId ?? null,
            reason: options.reason ?? "manual_assignment"
          }
        }
      });
      await createSupportAssignmentAudit(tx, {
        ticketId: ticket.id,
        ticketCode: ticket.code,
        businessId: ticket.businessId,
        assignedAgentId: agent.id,
        assignedByUserId,
        source: options.source ?? "manual",
        reason: options.reason ?? "manual_assignment",
        timestamp: now
      });
    }

    return { ticketId: ticket.id, agentId: agent.id, agentName: agent.name };
  });
}

export async function getSupportQueuePosition(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, assignedToUserId: true }
  });
  if (!ticket || ticket.status !== "OPEN" || ticket.assignedToUserId) return null;

  const queuedTickets = await prisma.supportTicket.findMany({
    where: { status: "OPEN", assignedToUserId: null },
    orderBy: [{ createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      priority: true,
      firstResponseDueAt: true,
      createdAt: true,
      lastMessageAt: true
    }
  });
  const sortedTickets = [...queuedTickets].sort(compareQueuedTickets);
  const index = sortedTickets.findIndex((queuedTicket) => queuedTicket.id === ticket.id);
  return index >= 0 ? index + 1 : null;
}

export function isSupportConversationActive(status: SupportTicketStatus) {
  return activeConversationStatuses.includes(status);
}

async function claimQueuedTicket(ticketId: string, agentId: string, options: AutoAssignSupportQueueOptions = {}) {
  return prisma.$transaction(async (tx) => {
    const [ticket, agent] = await Promise.all([
      tx.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, code: true, businessId: true, status: true, assignedToUserId: true }
      }),
      tx.user.findFirst({
        where: { id: agentId, role: { in: agentRoles } },
        select: { id: true, name: true }
      })
    ]);
    if (!ticket || ticket.status !== "OPEN" || ticket.assignedToUserId || !agent) return null;

    const busy = await supportAgentHasActiveTicket(tx, agent.id);
    if (busy) return null;

    const claimed = await tx.supportTicket.updateMany({
      where: { id: ticket.id, status: "OPEN", assignedToUserId: null },
      data: {
        assignedToUserId: agent.id,
        assignedAt: new Date(),
        status: "IN_REVIEW"
      }
    });
    if (claimed.count !== 1) return null;

    await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: "SYSTEM",
        body: `Agent ${agent.name} connected to you.`,
        metadata: {
          assignment: options.source ?? "system",
          agentId: agent.id,
          reason: options.reason ?? "queue_auto_assignment"
        }
      }
    });
    await createSupportAssignmentAudit(tx, {
      ticketId: ticket.id,
      ticketCode: ticket.code,
      businessId: ticket.businessId,
      assignedAgentId: agent.id,
      assignedByUserId: options.assignedByUserId ?? null,
      source: options.source ?? "system",
      reason: options.reason ?? "queue_auto_assignment",
      timestamp: new Date()
    });

    return { ticketId: ticket.id, agentId: agent.id, agentName: agent.name };
  });
}

async function createSupportAssignmentAudit(
  tx: Prisma.TransactionClient,
  input: {
    ticketId: string;
    ticketCode: string;
    businessId: string | null;
    assignedAgentId: string;
    assignedByUserId?: string | null;
    source: SupportAssignmentSource;
    reason: string;
    timestamp: Date;
  }
) {
  await tx.auditLog.create({
    data: {
      userId: input.assignedByUserId ?? undefined,
      businessId: input.businessId ?? undefined,
      action: "SUPPORT_TICKET_ASSIGNED",
      entity: "SupportTicket",
      entityId: input.ticketId,
      metadata: {
        ticketId: input.ticketId,
        code: input.ticketCode,
        businessId: input.businessId,
        assignedAgentId: input.assignedAgentId,
        assignedBy: input.assignedByUserId ?? "system",
        reason: input.reason,
        timestamp: input.timestamp.toISOString(),
        source: input.source
      }
    }
  });
}

async function supportAgentHasActiveTicket(tx: PrismaExecutor, agentId: string, exceptTicketId?: string) {
  const activeTicket = await tx.supportTicket.findFirst({
    where: {
      assignedToUserId: agentId,
      status: { in: activeConversationStatuses },
      ...(exceptTicketId ? { id: { not: exceptTicketId } } : {})
    },
    select: { id: true }
  });
  return Boolean(activeTicket);
}

async function findNextQueuedTicket(tx: PrismaExecutor, skipTicketIds: string[] = []) {
  const queuedTickets = await tx.supportTicket.findMany({
    where: {
      status: "OPEN",
      assignedToUserId: null,
      ...(skipTicketIds.length > 0 ? { id: { notIn: skipTicketIds } } : {})
    },
    orderBy: [{ createdAt: "asc" }],
    take: 50,
    select: {
      id: true,
      priority: true,
      firstResponseDueAt: true,
      createdAt: true,
      lastMessageAt: true
    }
  });

  return [...queuedTickets].sort(compareQueuedTickets)[0] ?? null;
}

function compareQueuedTickets(
  left: { priority: SupportTicketPriority; firstResponseDueAt: Date | null; createdAt: Date; lastMessageAt: Date },
  right: { priority: SupportTicketPriority; firstResponseDueAt: Date | null; createdAt: Date; lastMessageAt: Date }
) {
  const priorityDiff = priorityRank[right.priority] - priorityRank[left.priority];
  if (priorityDiff !== 0) return priorityDiff;

  const leftDue = left.firstResponseDueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightDue = right.firstResponseDueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) return leftDue - rightDue;

  const createdDiff = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;
  return left.lastMessageAt.getTime() - right.lastMessageAt.getTime();
}
