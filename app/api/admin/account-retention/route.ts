import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  accountDeletionPayload,
  accountRetentionAdminActionSchema,
  accountRetentionPolicyIsApproved
} from "@/lib/account-deletion";
import {
  completeBusinessRetentionReviewWithClient,
  purgeBusinessRetentionWithClient
} from "@/lib/account-deletion-service";
import { getAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function retentionPayload(request: Awaited<ReturnType<typeof findRetentionRequest>>) {
  if (!request) return null;
  return {
    ...accountDeletionPayload(request),
    business: request.business
  };
}

function findRetentionRequest(requestId: string) {
  return prisma.accountDeletionRequest.findUnique({
    where: { id: requestId },
    include: { business: { select: { id: true, name: true, email: true } } }
  });
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requests = await prisma.accountDeletionRequest.findMany({
    where: { scope: "BUSINESS" },
    include: { business: { select: { id: true, name: true, email: true } } },
    orderBy: [{ retentionPurgedAt: "asc" }, { retentionReviewAt: "asc" }, { createdAt: "desc" }],
    take: 200
  });
  const now = new Date();
  return NextResponse.json(
    {
      requests: requests.map((request) => retentionPayload(request)),
      policyApprovedVersion: process.env.ACCOUNT_RETENTION_POLICY_APPROVED_VERSION?.trim() || null,
      generatedAt: now.toISOString()
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = accountRetentionAdminActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Retention action is invalid." }, { status: 400 });
  }

  // Keep the validated discriminated-union value in a local constant. Apart from
  // making the subsequent transactions easier to read, this preserves TypeScript
  // narrowing inside their async callbacks.
  const action = parsed.data;
  const now = new Date();
  const current = await findRetentionRequest(action.requestId);
  if (!current || current.scope !== "BUSINESS") {
    return NextResponse.json({ error: "Retention request was not found." }, { status: 404 });
  }
  if (current.status !== "COMPLETED" || current.retentionPurgedAt) {
    return NextResponse.json({ error: "Retention request is not active." }, { status: 409 });
  }

  if (
    (action.action === "complete_review" || action.action === "purge_due_records") &&
    !accountRetentionPolicyIsApproved(current.retentionNoticeVersion)
  ) {
    return NextResponse.json(
      {
        error: "The exact retention-policy version must be owner/counsel approved in production before this action.",
        code: "RETENTION_POLICY_APPROVAL_REQUIRED"
      },
      { status: 409 }
    );
  }

  try {
    if (action.action === "complete_review") {
      await prisma.$transaction(
        (tx) =>
          completeBusinessRetentionReviewWithClient(tx, {
            requestId: current.id,
            now,
            actorUserId: session.id,
            note: action.note
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } else if (action.action === "purge_due_records") {
      await prisma.$transaction(
        (tx) =>
          purgeBusinessRetentionWithClient(tx, {
            requestId: current.id,
            now,
            actorUserId: session.id
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } else if (action.action === "set_hold") {
      if (action.holdUntil <= now) {
        return NextResponse.json({ error: "Legal hold end must be in the future." }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.accountDeletionRequest.update({
          where: { id: current.id },
          data: {
            retentionHoldUntil: action.holdUntil,
            retentionHoldReason: action.reason
          }
        });
        await tx.auditLog.create({
          data: {
            userId: session.id,
            businessId: current.businessId,
            action: "ACCOUNT_RETENTION_LEGAL_HOLD_SET",
            entity: "AccountDeletionRequest",
            entityId: current.id,
            metadata: {
              holdUntil: action.holdUntil.toISOString(),
              reason: action.reason
            }
          }
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.accountDeletionRequest.update({
          where: { id: current.id },
          data: { retentionHoldUntil: null, retentionHoldReason: null }
        });
        await tx.auditLog.create({
          data: {
            userId: session.id,
            businessId: current.businessId,
            action: "ACCOUNT_RETENTION_LEGAL_HOLD_RELEASED",
            entity: "AccountDeletionRequest",
            entityId: current.id,
            metadata: { reason: action.reason }
          }
        });
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("RETENTION_")) {
      return NextResponse.json({ error: "Retention state changed or the action is not due." }, { status: 409 });
    }
    return NextResponse.json({ error: "Retention action failed with no partial change committed." }, { status: 500 });
  }

  return NextResponse.json({ request: retentionPayload(await findRetentionRequest(current.id)) });
}
