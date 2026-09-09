import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
  BUSINESS_ACCOUNT_RETENTION_NOTICE
} from "@/lib/account-deletion";
import { purgeBusinessRetentionWithClient } from "@/lib/account-deletion-service";
import { prisma } from "@/lib/prisma";

function requireDisposableDatabase() {
  if (process.env.ACCOUNT_RETENTION_INTEGRATION_TEST !== "true") {
    throw new Error("Set ACCOUNT_RETENTION_INTEGRATION_TEST=true for this destructive disposable-database test.");
  }
  const databaseUrl = new URL(process.env.DATABASE_URL || "");
  if (!["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
    throw new Error("Account-retention integration test refuses every non-local database host.");
  }
}

async function main() {
  requireDisposableDatabase();
  const marker = randomUUID();
  const businessId = `retention-business-${marker}`;
  const requestId = `retention-request-${marker}`;
  const now = new Date("2035-08-17T00:00:00.000Z");

  try {
    await prisma.business.create({
      data: {
        id: businessId,
        name: "Synthetic retention test business",
        slug: `retention-test-${marker}`,
        ownerName: "Synthetic owner",
        phone: `test-${marker}`,
        email: `${marker}@retention-test.invalid`,
        address: "Synthetic address",
        city: "Bengaluru",
        state: "Karnataka",
        businessType: "services"
      }
    });
    await prisma.accountDeletionRequest.create({
      data: {
        id: requestId,
        scope: "BUSINESS",
        status: "COMPLETED",
        businessId,
        retentionNoticeVersion: ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
        retentionNotice: BUSINESS_ACCOUNT_RETENTION_NOTICE,
        scheduledFor: new Date("2026-09-16T00:00:00.000Z"),
        completedAt: new Date("2026-09-16T00:00:00.000Z"),
        retentionReviewAt: new Date("2027-09-16T00:00:00.000Z"),
        retentionPurgeAfter: new Date("2034-09-16T00:00:00.000Z"),
        result: { syntheticIntegrationFixture: true }
      }
    });

    await prisma.$transaction(
      (tx) => purgeBusinessRetentionWithClient(tx, { requestId, now }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const [business, request, audit] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.accountDeletionRequest.findUnique({ where: { id: requestId } }),
      prisma.auditLog.findFirst({
        where: {
          action: "ACCOUNT_RETENTION_FINAL_PURGE_COMPLETED",
          entity: "AccountDeletionRequest",
          entityId: requestId
        }
      })
    ]);
    assert.equal(business, null);
    assert.ok(request);
    assert.equal(request.businessId, null);
    assert.equal(request.retentionPurgedAt?.toISOString(), now.toISOString());
    assert.ok(audit);
    console.log("Account-retention final purge integration test passed.");
  } finally {
    await prisma.auditLog.deleteMany({ where: { entity: "AccountDeletionRequest", entityId: requestId } });
    await prisma.accountDeletionRequest.deleteMany({ where: { id: requestId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
