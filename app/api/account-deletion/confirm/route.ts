import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  accountDeletionPayload,
  accountDeletionRetentionSchedule,
  accountDeletionScheduledFor,
  publicAccountDeletionConfirmSchema
} from "@/lib/account-deletion";
import {
  accountDeletionTokenMatches,
  confirmationForDeletionScope,
  parseAccountDeletionEmailToken
} from "@/lib/account-deletion-public";
import {
  deletePersonalAccountWithClient,
  freezeBusinessForDeletionWithClient
} from "@/lib/account-deletion-service";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { safeLog } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseSelect = {
  id: true,
  scope: true,
  status: true,
  scheduledFor: true,
  processingAt: true,
  completedAt: true,
  cancelledAt: true,
  retentionNoticeVersion: true,
  retentionNotice: true,
  verifiedAt: true,
  result: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AccountDeletionRequestSelect;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const bucket = await rateLimit(`public-account-delete-confirm:${ip}`, 8, 30 * 60_000);
  if (!bucket.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const parsed = publicAccountDeletionConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Deletion confirmation is invalid." }, { status: 400 });
  const token = parseAccountDeletionEmailToken(parsed.data.token);
  if (!token) return NextResponse.json({ error: "Deletion link is invalid or expired." }, { status: 400 });

  try {
    const completed = await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const deletionRequest = await tx.accountDeletionRequest.findUnique({
          where: { id: token.requestId },
          select: {
            id: true,
            scope: true,
            status: true,
            requesterUserId: true,
            businessId: true,
            verificationTokenHash: true,
            verificationExpiresAt: true,
            requester: { select: { id: true, role: true, businessId: true, emailVerifiedAt: true } }
          }
        });
        if (
          !deletionRequest ||
          deletionRequest.status !== "AWAITING_VERIFICATION" ||
          !deletionRequest.verificationTokenHash ||
          !deletionRequest.verificationExpiresAt ||
          deletionRequest.verificationExpiresAt <= now ||
          !accountDeletionTokenMatches(deletionRequest.verificationTokenHash, token.hash) ||
          !deletionRequest.requester?.emailVerifiedAt
        ) {
          throw new Error("INVALID_DELETION_TOKEN");
        }
        if (parsed.data.confirmation !== confirmationForDeletionScope(deletionRequest.scope)) {
          throw new Error("INVALID_DELETION_CONFIRMATION");
        }

        if (deletionRequest.scope === "BUSINESS") {
          if (
            deletionRequest.requester.role !== "OWNER" ||
            !deletionRequest.businessId ||
            deletionRequest.requester.businessId !== deletionRequest.businessId
          ) {
            throw new Error("INVALID_DELETION_SCOPE");
          }
          const scheduledFor = accountDeletionScheduledFor(now);
          const freeze = await freezeBusinessForDeletionWithClient(tx, {
            businessId: deletionRequest.businessId,
            now,
            reason: "verified_account_deletion_requested"
          });
          await tx.auditLog.create({
            data: {
              userId: deletionRequest.requester.id,
              businessId: deletionRequest.businessId,
              action: "BUSINESS_ACCOUNT_DELETION_VERIFIED",
              entity: "AccountDeletionRequest",
              entityId: deletionRequest.id,
              metadata: { initiation: "verified_email", scheduledFor: scheduledFor.toISOString(), ...freeze }
            }
          });
          return tx.accountDeletionRequest.update({
            where: { id: deletionRequest.id },
            data: {
              status: "REQUESTED",
              verifiedAt: now,
              scheduledFor,
              result: freeze,
              verificationTokenHash: null,
              verificationExpiresAt: null
            },
            select: responseSelect
          });
        }

        const expectedRoles =
          deletionRequest.scope === "CUSTOMER"
            ? (["CUSTOMER"] as const)
            : (["MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"] as const);
        const deleted = await deletePersonalAccountWithClient(tx, {
          userId: deletionRequest.requester.id,
          allowedRoles: expectedRoles,
          requestId: deletionRequest.id,
          auditContext: { initiation: "verified_email" }
        });
        return tx.accountDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: "COMPLETED",
            verifiedAt: now,
            processingAt: now,
            completedAt: now,
            ...accountDeletionRetentionSchedule(now),
            result: deleted.result,
            verificationTokenHash: null,
            verificationExpiresAt: null
          },
          select: responseSelect
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json(
      { accountDeletion: accountDeletionPayload(completed) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("INVALID_DELETION_")) {
      return NextResponse.json({ error: "Deletion link or confirmation is invalid or expired." }, { status: 400 });
    }
    safeLog("error", "Verified account deletion failed", { error, requestId: token.requestId });
    return NextResponse.json(
      { error: "Deletion could not be completed. No partial deletion was committed." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
