import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ACCOUNT_DELETION_PROCESSING_LEASE_MS,
  accountDeletionIdempotencyHash,
  accountDeletionRetentionSchedule,
  accountDeletionScheduledFor,
  accountRetentionAdminActionSchema,
  accountRetentionPolicyIsApproved,
  BUSINESS_ACCOUNT_DELETE_CONFIRMATION,
  businessAccountDeletionSchema,
  nextAccountDeletionRetentionReview,
  personalAccountDeletionSchema,
  publicAccountDeletionRequestSchema,
  validIdempotencyKey
} from "@/lib/account-deletion";
import {
  accountDeletionTokenMatches,
  createAccountDeletionEmailToken,
  parseAccountDeletionEmailToken
} from "@/lib/account-deletion-public";
import { requeueStalledBusinessAccountDeletionRequests } from "@/lib/account-deletion-job";
import { deletePersonalAccountWithClient } from "@/lib/account-deletion-service";

process.env.ACCOUNT_DELETION_TOKEN_PEPPER = "account-deletion-test-pepper-that-is-over-thirty-two-bytes";

test("business deletion requires password and the exact destructive phrase", () => {
  assert.equal(
    businessAccountDeletionSchema.safeParse({
      currentPassword: "valid-password",
      confirmation: BUSINESS_ACCOUNT_DELETE_CONFIRMATION
    }).success,
    true
  );
  assert.equal(
    businessAccountDeletionSchema.safeParse({ currentPassword: "valid-password", confirmation: "delete" }).success,
    false
  );
  assert.equal(
    personalAccountDeletionSchema.safeParse({ currentPassword: "valid-password", confirmation: "DELETE MY ACCOUNT" }).success,
    true
  );
});

test("business deletion is scheduled exactly thirty days from the request time", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");
  assert.equal(accountDeletionScheduledFor(now).toISOString(), "2026-09-16T00:00:00.000Z");
});

test("business retention deadlines and annual checkpoints are deterministic", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");
  const schedule = accountDeletionRetentionSchedule(now);
  assert.equal(schedule.retentionReviewAt.toISOString(), "2027-08-17T00:00:00.000Z");
  assert.equal(schedule.retentionPurgeAfter.toISOString(), "2034-08-17T00:00:00.000Z");
  assert.equal(
    nextAccountDeletionRetentionReview(new Date("2034-01-01T00:00:00.000Z"), schedule.retentionPurgeAfter).toISOString(),
    schedule.retentionPurgeAfter.toISOString()
  );
});

test("retention operations require the exact approved notice version and destructive phrases", () => {
  assert.equal(accountRetentionPolicyIsApproved("2026-08-17", "2026-08-17"), true);
  assert.equal(accountRetentionPolicyIsApproved("2026-08-17", "2026-08-18"), false);
  assert.equal(
    accountRetentionAdminActionSchema.safeParse({
      requestId: "retention-request-123",
      action: "complete_review",
      confirmation: "RETAIN UNDER APPROVED POLICY",
      note: "Approved category schedule remains applicable."
    }).success,
    true
  );
  assert.equal(
    accountRetentionAdminActionSchema.safeParse({
      requestId: "retention-request-123",
      action: "purge_due_records",
      confirmation: "PURGE"
    }).success,
    false
  );
});

test("idempotency key validation and hashing are deterministic and domain separated", () => {
  assert.equal(validIdempotencyKey("deletion-request-123456"), true);
  assert.equal(validIdempotencyKey("short"), false);
  assert.equal(accountDeletionIdempotencyHash("deletion-request-123456").length, 64);
  assert.notEqual(accountDeletionIdempotencyHash("deletion-request-123456"), accountDeletionIdempotencyHash("deletion-request-123457"));
});

test("public request accepts normalized email only", () => {
  const parsed = publicAccountDeletionRequestSchema.parse({ email: " Person@Example.COM " });
  assert.equal(parsed.email, "person@example.com");
  assert.equal(publicAccountDeletionRequestSchema.safeParse({ email: "not-an-email" }).success, false);
});

test("post-uninstall verification tokens are opaque, parsed, and tamper evident", () => {
  const token = createAccountDeletionEmailToken("00000000-0000-4000-8000-000000000000");
  const parsed = parseAccountDeletionEmailToken(token.raw);
  assert.ok(parsed);
  assert.equal(parsed.requestId, "00000000-0000-4000-8000-000000000000");
  assert.equal(accountDeletionTokenMatches(parsed.hash, token.hash), true);
  assert.equal(parseAccountDeletionEmailToken(`${token.raw}x`), null);
});

test("deletion job requeues only stale business-processing leases without clearing retention data", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const now = new Date("2026-08-18T08:00:00.000Z");
  const client = {
    accountDeletionRequest: {
      updateMany: async (input: Record<string, unknown>) => {
        calls.push(input);
        return { count: 1 };
      }
    }
  } as unknown as Pick<PrismaClient, "accountDeletionRequest">;

  const recovered = await requeueStalledBusinessAccountDeletionRequests(client, now);

  assert.equal(recovered.count, 1);
  assert.deepEqual(calls, [
    {
      where: {
        scope: "BUSINESS",
        status: "PROCESSING",
        scheduledFor: { lte: now },
        OR: [
          { processingAt: null },
          { processingAt: { lt: new Date(now.getTime() - ACCOUNT_DELETION_PROCESSING_LEASE_MS) } }
        ]
      },
      data: { status: "REQUESTED", processingAt: null }
    }
  ]);
});

test("staff deletion preserves retained appointment-provider locations while deactivating the provider", async () => {
  const providerUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    user: {
      findUnique: async () => ({
        id: "staff-user",
        email: "staff@example.test",
        phone: null,
        phoneVerifiedAt: null,
        role: "MANAGER",
        businessId: "business-1",
        _count: { mobileSessions: 0 }
      }),
      deleteMany: async () => ({ count: 1 })
    },
    supportTicket: { findMany: async () => [] },
    supportTicketMessage: { updateMany: async () => ({ count: 0 }) },
    auditLog: {
      updateMany: async () => ({ count: 0 }),
      create: async () => ({ id: "audit-1" })
    },
    appointmentProvider: {
      findMany: async () => [{ id: "provider-1", _count: { appointments: 1 } }],
      deleteMany: async () => ({ count: 0 }),
      updateMany: async (input: { data: Record<string, unknown> }) => {
        providerUpdates.push(input.data);
        return { count: 1 };
      }
    },
    appointmentProviderService: { deleteMany: async () => ({ count: 0 }) },
    appointmentAvailabilityRule: { deleteMany: async () => ({ count: 0 }) },
    appointmentTimeOff: { deleteMany: async () => ({ count: 0 }) }
  } as unknown as Prisma.TransactionClient;

  await deletePersonalAccountWithClient(tx, {
    userId: "staff-user",
    allowedRoles: ["MANAGER"]
  });

  assert.deepEqual(providerUpdates, [
    {
      userId: null,
      name: "Deleted staff member",
      title: "Former staff",
      bio: null,
      isActive: false
    }
  ]);
});
