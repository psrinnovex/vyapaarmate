import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
  accountDeletionIdempotencyHash,
  accountDeletionPayload,
  accountDeletionScheduledFor,
  BUSINESS_ACCOUNT_RETENTION_NOTICE,
  businessAccountDeletionSchema,
  validIdempotencyKey
} from "@/lib/account-deletion";
import { getSessionUser } from "@/lib/api-session";
import { freezeBusinessForDeletionWithClient } from "@/lib/account-deletion-service";
import { verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { cookieName } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSelect = {
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

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" }
  });
}

async function ownerSession() {
  const session = await getSessionUser();
  return session?.role === "OWNER" && session.businessId ? session : null;
}

export async function GET() {
  const session = await ownerSession();
  if (!session) return json({ error: "Forbidden" }, 403);

  const request = await prisma.accountDeletionRequest.findFirst({
    where: { businessId: session.businessId, scope: "BUSINESS" },
    orderBy: { createdAt: "desc" },
    select: requestSelect
  });
  return json({ accountDeletion: request ? accountDeletionPayload(request) : null });
}

export async function POST(request: Request) {
  const session = await ownerSession();
  if (!session) return json({ error: "Forbidden" }, 403);

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!validIdempotencyKey(idempotencyKey)) {
    return json({ error: "Provide a unique Idempotency-Key containing 16-128 safe characters." }, 400);
  }

  const ip = getClientIp(request);
  const bucket = await rateLimit(`business-account-delete:${session.id}:${ip}`, 3, 30 * 60_000);
  if (!bucket.allowed) return json({ error: "Too many deletion attempts. Try again later." }, 429);

  const parsed = businessAccountDeletionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const user = await prisma.user.findUnique({
    where: { id: session.id, role: "OWNER" },
    select: { id: true, passwordHash: true, businessId: true }
  });
  if (!user?.businessId || user.businessId !== session.businessId) return json({ error: "Forbidden" }, 403);
  const businessId = user.businessId;
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return json({ error: "Current password is incorrect." }, 400);
  }

  const now = new Date();
  const scheduledFor = accountDeletionScheduledFor(now);
  const idempotencyKeyHash = accountDeletionIdempotencyHash(idempotencyKey!);

  try {
    const deletionRequest = await prisma.$transaction(
      async (tx) => {
        const replay = await tx.accountDeletionRequest.findUnique({
          where: { idempotencyKeyHash },
          select: requestSelect
        });
        if (replay) return replay;

        const active = await tx.accountDeletionRequest.findFirst({
          where: {
            businessId,
            scope: "BUSINESS",
            status: { in: ["REQUESTED", "PROCESSING"] }
          },
          orderBy: { createdAt: "desc" },
          select: requestSelect
        });
        if (active) return active;

        await tx.accountDeletionRequest.updateMany({
          where: { requesterUserId: user.id, status: "AWAITING_VERIFICATION" },
          data: {
            status: "REJECTED",
            cancelledAt: now,
            verificationTokenHash: null,
            verificationExpiresAt: null
          }
        });

        const created = await tx.accountDeletionRequest.create({
          data: {
            scope: "BUSINESS",
            status: "REQUESTED",
            requesterUserId: user.id,
            businessId,
            idempotencyKeyHash,
            reason: parsed.data.reason || null,
            retentionNoticeVersion: ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
            retentionNotice: BUSINESS_ACCOUNT_RETENTION_NOTICE,
            scheduledFor,
            verifiedAt: now
          },
          select: requestSelect
        });

        const freeze = await freezeBusinessForDeletionWithClient(tx, {
          businessId,
          now,
          reason: "account_deletion_requested"
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            businessId,
            action: "BUSINESS_ACCOUNT_DELETION_REQUESTED",
            entity: "AccountDeletionRequest",
            entityId: created.id,
            metadata: {
              ip,
              scheduledFor: scheduledFor.toISOString(),
              retentionNoticeVersion: ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
              ...freeze
            }
          }
        });

        return tx.accountDeletionRequest.update({
          where: { id: created.id },
          data: { result: freeze },
          select: requestSelect
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const response = json({ accountDeletion: accountDeletionPayload(deletionRequest) }, 202);
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      priority: "high",
      path: "/",
      maxAge: 0
    });
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await prisma.accountDeletionRequest.findUnique({
        where: { idempotencyKeyHash },
        select: requestSelect
      });
      if (replay) return json({ accountDeletion: accountDeletionPayload(replay) }, 202);
    }
    return json({ error: "Account deletion could not be scheduled. No partial deletion was completed." }, 503);
  }
}
