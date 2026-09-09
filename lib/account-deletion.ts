import { createHash } from "node:crypto";
import { z } from "zod";
import { CUSTOMER_ACCOUNT_DELETE_CONFIRMATION } from "@/lib/customer-account-copy";

export const BUSINESS_ACCOUNT_DELETE_CONFIRMATION = "DELETE MY BUSINESS ACCOUNT";
export const ACCOUNT_DELETION_RETENTION_NOTICE_VERSION = "2026-08-17";
export const BUSINESS_ACCOUNT_DELETION_DELAY_DAYS = 30;
export const ACCOUNT_DELETION_RETENTION_REVIEW_DAYS = 365;
export const BUSINESS_RECORD_MAXIMUM_RETENTION_YEARS = 8;
export const ACCOUNT_DELETION_JOB_BATCH_SIZE = 5;
export const ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS = 120_000;
// Must exceed the deletion transaction timeout so a live worker is never
// reclaimed while its serializable transaction is still allowed to run.
export const ACCOUNT_DELETION_PROCESSING_LEASE_MS = 15 * 60_000;
export const ACCOUNT_DELETION_EMAIL_TOKEN_LIFETIME_MS = 30 * 60_000;
export const ACCOUNT_RETENTION_PURGE_CONFIRMATION = "PURGE RETAINED BUSINESS RECORDS";

export const STAFF_ACCOUNT_RETENTION_NOTICE =
  "Your staff sign-in identity, active sessions, profile links, and personal support content are removed. Historical appointments, orders, payments, and security events remain only as de-identified operational, accounting, fraud-prevention, dispute, or audit records where required.";

export const BUSINESS_ACCOUNT_RETENTION_NOTICE =
  "Your storefront, commerce, subscription access, messaging integrations, and active sessions are disabled immediately. After 30 days, VyapaarMate removes business login identities, KYC document uploads, integrations, non-required catalogue/intelligence data, customer contact details, delivery locations, free-text notes, and personal support content. De-identified order and appointment facts plus required invoice, payment, payout, minimal verification outcome, tax, fraud-prevention, dispute, security, and audit records are retained only for their documented basis, reviewed annually, and scheduled for final purge no later than eight years after completion unless a recorded legal hold requires longer.";

export const businessAccountDeletionSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(256),
    confirmation: z.literal(BUSINESS_ACCOUNT_DELETE_CONFIRMATION),
    reason: z.string().trim().max(500).optional()
  })
  .strict();

export const personalAccountDeletionSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(256),
    confirmation: z.literal(CUSTOMER_ACCOUNT_DELETE_CONFIRMATION)
  })
  .strict();

export const publicAccountDeletionRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();

export const publicAccountDeletionConfirmSchema = z
  .object({
    token: z.string().min(64).max(300),
    confirmation: z.string().min(1).max(64)
  })
  .strict();

const retentionHoldUntilSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const accountRetentionAdminActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      requestId: z.string().min(1).max(100),
      action: z.literal("complete_review"),
      confirmation: z.literal("RETAIN UNDER APPROVED POLICY"),
      note: z.string().trim().min(10).max(500)
    })
    .strict(),
  z
    .object({
      requestId: z.string().min(1).max(100),
      action: z.literal("set_hold"),
      holdUntil: retentionHoldUntilSchema,
      reason: z.string().trim().min(10).max(500)
    })
    .strict(),
  z
    .object({
      requestId: z.string().min(1).max(100),
      action: z.literal("release_hold"),
      reason: z.string().trim().min(10).max(500)
    })
    .strict(),
  z
    .object({
      requestId: z.string().min(1).max(100),
      action: z.literal("purge_due_records"),
      confirmation: z.literal(ACCOUNT_RETENTION_PURGE_CONFIRMATION)
    })
    .strict()
]);

export function accountDeletionScheduledFor(now = new Date()) {
  return new Date(now.getTime() + BUSINESS_ACCOUNT_DELETION_DELAY_DAYS * 24 * 60 * 60_000);
}

export function accountDeletionRetentionSchedule(now = new Date()) {
  const retentionReviewAt = new Date(now.getTime() + ACCOUNT_DELETION_RETENTION_REVIEW_DAYS * 24 * 60 * 60_000);
  const retentionPurgeAfter = new Date(now);
  retentionPurgeAfter.setUTCFullYear(retentionPurgeAfter.getUTCFullYear() + BUSINESS_RECORD_MAXIMUM_RETENTION_YEARS);
  return { retentionReviewAt, retentionPurgeAfter };
}

export function nextAccountDeletionRetentionReview(now: Date, retentionPurgeAfter: Date) {
  const nextReview = new Date(now);
  nextReview.setUTCFullYear(nextReview.getUTCFullYear() + 1);
  return nextReview < retentionPurgeAfter ? nextReview : retentionPurgeAfter;
}

export function accountRetentionPolicyIsApproved(
  retentionNoticeVersion: string,
  approvedVersion = process.env.ACCOUNT_RETENTION_POLICY_APPROVED_VERSION?.trim()
) {
  return Boolean(approvedVersion && approvedVersion === retentionNoticeVersion);
}

export function accountDeletionIdempotencyHash(value: string) {
  return createHash("sha256").update("account-deletion\0").update(value).digest("hex");
}

export function validIdempotencyKey(value: string | null) {
  return Boolean(value && /^[A-Za-z0-9._~-]{16,128}$/.test(value));
}

export function accountDeletionPayload(request: {
  id: string;
  scope: string;
  status: string;
  scheduledFor: Date;
  processingAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  retentionReviewAt?: Date | null;
  retentionLastReviewedAt?: Date | null;
  retentionReviewCount?: number;
  retentionPurgeAfter?: Date | null;
  retentionPurgedAt?: Date | null;
  retentionHoldUntil?: Date | null;
  retentionHoldReason?: string | null;
  retentionNoticeVersion: string;
  retentionNotice: string;
  verifiedAt?: Date | null;
  result?: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: request.id,
    scope: request.scope,
    status: request.status,
    scheduledFor: request.scheduledFor.toISOString(),
    processingAt: request.processingAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    retentionReviewAt: request.retentionReviewAt?.toISOString() ?? null,
    retentionLastReviewedAt: request.retentionLastReviewedAt?.toISOString() ?? null,
    retentionReviewCount: request.retentionReviewCount ?? 0,
    retentionPurgeAfter: request.retentionPurgeAfter?.toISOString() ?? null,
    retentionPurgedAt: request.retentionPurgedAt?.toISOString() ?? null,
    retentionHoldUntil: request.retentionHoldUntil?.toISOString() ?? null,
    retentionHoldReason: request.retentionHoldReason ?? null,
    retentionNoticeVersion: request.retentionNoticeVersion,
    retentionNotice: request.retentionNotice,
    verifiedAt: request.verifiedAt?.toISOString() ?? null,
    ...(request.result !== undefined ? { result: request.result } : {}),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}
