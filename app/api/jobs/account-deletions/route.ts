import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  ACCOUNT_DELETION_JOB_BATCH_SIZE,
  ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS,
  accountRetentionPolicyIsApproved
} from "@/lib/account-deletion";
import {
  processBusinessDeletionWithClient,
  purgeBusinessRetentionWithClient
} from "@/lib/account-deletion-service";
import { requeueStalledBusinessAccountDeletionRequests } from "@/lib/account-deletion-job";
import { prisma } from "@/lib/prisma";
import { requireCronRequest } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function processAccountDeletions(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const recovered = await requeueStalledBusinessAccountDeletionRequests(prisma, now);
  const due = await prisma.accountDeletionRequest.findMany({
    where: {
      scope: "BUSINESS",
      status: "REQUESTED",
      scheduledFor: { lte: now }
    },
    orderBy: { scheduledFor: "asc" },
    take: ACCOUNT_DELETION_JOB_BATCH_SIZE,
    select: { id: true }
  });

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of due) {
    const claimedAt = new Date();
    const claimed = await prisma.accountDeletionRequest.updateMany({
      where: { id: candidate.id, status: "REQUESTED", scheduledFor: { lte: now } },
      data: { status: "PROCESSING", processingAt: claimedAt }
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    try {
      const processed = await prisma.$transaction(
        async (tx) => {
          // This conditional write is both an ownership check and a row lock.
          // A stale worker cannot act after a newer worker reclaimed its lease.
          const owned = await tx.accountDeletionRequest.updateMany({
            where: { id: candidate.id, status: "PROCESSING", processingAt: claimedAt },
            data: { processingAt: claimedAt }
          });
          if (owned.count !== 1) return false;

          const deletionRequest = await tx.accountDeletionRequest.findUnique({
            where: { id: candidate.id },
            select: { id: true, businessId: true, status: true }
          });
          if (!deletionRequest || deletionRequest.status !== "PROCESSING" || !deletionRequest.businessId) {
            return false;
          }
          await processBusinessDeletionWithClient(tx, {
            requestId: deletionRequest.id,
            businessId: deletionRequest.businessId,
            now
          });
          return true;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS
        }
      );
      if (processed) completed += 1;
      else skipped += 1;
    } catch {
      failed += 1;
      await prisma.accountDeletionRequest
        .updateMany({
          where: { id: candidate.id, status: "PROCESSING", processingAt: claimedAt },
          data: {
            status: "REQUESTED",
            processingAt: null,
            result: { retryRequired: true }
          }
        })
        .catch(() => undefined);
    }
  }

  const duePurges = await prisma.accountDeletionRequest.findMany({
    where: {
      scope: "BUSINESS",
      status: "COMPLETED",
      retentionPurgedAt: null,
      retentionPurgeAfter: { lte: now },
      OR: [{ retentionHoldUntil: null }, { retentionHoldUntil: { lte: now } }]
    },
    orderBy: { retentionPurgeAfter: "asc" },
    take: ACCOUNT_DELETION_JOB_BATCH_SIZE,
    select: { id: true, retentionNoticeVersion: true }
  });
  let retentionPurged = 0;
  let retentionPurgeFailed = 0;
  let retentionPolicyApprovalRequired = 0;

  for (const candidate of duePurges) {
    if (!accountRetentionPolicyIsApproved(candidate.retentionNoticeVersion)) {
      retentionPolicyApprovalRequired += 1;
      continue;
    }
    try {
      await prisma.$transaction(
        (tx) => purgeBusinessRetentionWithClient(tx, { requestId: candidate.id, now }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS
        }
      );
      retentionPurged += 1;
    } catch {
      retentionPurgeFailed += 1;
    }
  }

  const [retentionReviewsDue, retentionPurgesHeld] = await Promise.all([
    prisma.accountDeletionRequest.count({
      where: {
        scope: "BUSINESS",
        status: "COMPLETED",
        retentionPurgedAt: null,
        retentionReviewAt: { lte: now },
        retentionPurgeAfter: { gt: now }
      }
    }),
    prisma.accountDeletionRequest.count({
      where: {
        scope: "BUSINESS",
        status: "COMPLETED",
        retentionPurgedAt: null,
        retentionPurgeAfter: { lte: now },
        retentionHoldUntil: { gt: now }
      }
    })
  ]);

  return NextResponse.json(
    {
      deletion: { checked: due.length, recovered: recovered.count, completed, failed, skipped },
      retention: {
        purgeChecked: duePurges.length,
        purged: retentionPurged,
        failed: retentionPurgeFailed,
        policyApprovalRequired: retentionPolicyApprovalRequired,
        reviewsDue: retentionReviewsDue,
        purgesHeld: retentionPurgesHeld,
        requiresAction: retentionPolicyApprovalRequired > 0 || retentionReviewsDue > 0
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export function GET(request: Request) {
  return processAccountDeletions(request);
}

export function POST(request: Request) {
  return processAccountDeletions(request);
}
