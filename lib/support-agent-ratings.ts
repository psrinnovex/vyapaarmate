import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SupportAgentRatingStats = {
  average: number | null;
  count: number;
};

type SupportTicketRatingSource = {
  assignedToUserId: string | null;
  metadata: Prisma.JsonValue;
};

type RatingAccumulator = {
  total: number;
  count: number;
};

export function emptySupportAgentRatingStats(): SupportAgentRatingStats {
  return { average: null, count: 0 };
}

export async function getSupportAgentRatingStats(agentIds: string[]) {
  const uniqueAgentIds = [...new Set(agentIds)].filter(Boolean);
  if (uniqueAgentIds.length === 0) return new Map<string, SupportAgentRatingStats>();

  const tickets = await prisma.supportTicket.findMany({
    where: { assignedToUserId: { in: uniqueAgentIds } },
    select: { assignedToUserId: true, metadata: true }
  });

  return calculateSupportAgentRatingStats(tickets, uniqueAgentIds);
}

export function calculateSupportAgentRatingStats(tickets: SupportTicketRatingSource[], agentIds: string[] = []) {
  const accumulators = new Map<string, RatingAccumulator>();
  for (const agentId of agentIds) accumulators.set(agentId, { total: 0, count: 0 });

  for (const ticket of tickets) {
    if (!ticket.assignedToUserId) continue;
    const rating = readAgentFeedbackRating(ticket.metadata);
    if (rating === null) continue;

    const current = accumulators.get(ticket.assignedToUserId) ?? { total: 0, count: 0 };
    current.total += rating;
    current.count += 1;
    accumulators.set(ticket.assignedToUserId, current);
  }

  return new Map(
    [...accumulators.entries()].map(([agentId, stats]) => [
      agentId,
      {
        average: stats.count > 0 ? Math.round((stats.total / stats.count) * 10) / 10 : null,
        count: stats.count
      }
    ])
  );
}

function readAgentFeedbackRating(metadata: Prisma.JsonValue) {
  const root = jsonObject(metadata);
  const feedback = jsonObject(root?.agentFeedback);
  if (!feedback || typeof feedback.rating !== "number" || typeof feedback.submittedAt !== "string") return null;
  if (!Number.isFinite(feedback.rating) || feedback.rating < 1 || feedback.rating > 5) return null;
  return feedback.rating;
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
