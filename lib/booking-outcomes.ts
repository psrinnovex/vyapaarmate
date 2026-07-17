const noShowEligibleStatuses = new Set(["ACCEPTED", "PREPARING", "READY"]);

export type NoShowEligibility =
  | { allowed: true; reason: null }
  | {
      allowed: false;
      reason: "missing_schedule" | "before_schedule" | "invalid_status" | "already_recorded";
    };

export function getNoShowEligibility({
  status,
  scheduledFor,
  noShowAt,
  now = new Date()
}: {
  status: string;
  scheduledFor: Date | string | null | undefined;
  noShowAt?: Date | string | null;
  now?: Date;
}): NoShowEligibility {
  if (noShowAt) return { allowed: false, reason: "already_recorded" };
  if (!scheduledFor) return { allowed: false, reason: "missing_schedule" };

  const scheduledTime = scheduledFor instanceof Date ? scheduledFor.getTime() : new Date(scheduledFor).getTime();
  if (!Number.isFinite(scheduledTime)) return { allowed: false, reason: "missing_schedule" };
  if (scheduledTime > now.getTime()) return { allowed: false, reason: "before_schedule" };
  if (!noShowEligibleStatuses.has(status)) return { allowed: false, reason: "invalid_status" };

  return { allowed: true, reason: null };
}
