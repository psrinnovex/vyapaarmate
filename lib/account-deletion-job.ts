import type { PrismaClient } from "@prisma/client";
import { ACCOUNT_DELETION_PROCESSING_LEASE_MS } from "@/lib/account-deletion";

type AccountDeletionRequestStore = Pick<PrismaClient, "accountDeletionRequest">;

export function accountDeletionProcessingLeaseExpiredAt(now: Date) {
  return new Date(now.getTime() - ACCOUNT_DELETION_PROCESSING_LEASE_MS);
}

/**
 * A worker can terminate after marking a request PROCESSING but before its
 * transaction commits. Requeue only expired leases, preserving the business
 * freeze and any existing retention metadata for a later safe retry.
 */
export async function requeueStalledBusinessAccountDeletionRequests(
  client: AccountDeletionRequestStore,
  now: Date
) {
  return client.accountDeletionRequest.updateMany({
    where: {
      scope: "BUSINESS",
      status: "PROCESSING",
      scheduledFor: { lte: now },
      OR: [{ processingAt: null }, { processingAt: { lt: accountDeletionProcessingLeaseExpiredAt(now) } }]
    },
    data: { status: "REQUESTED", processingAt: null }
  });
}
