import { NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import {
  ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
  accountDeletionRetentionSchedule,
  accountDeletionPayload,
  personalAccountDeletionSchema,
  STAFF_ACCOUNT_RETENTION_NOTICE
} from "@/lib/account-deletion";
import { deletePersonalAccountWithClient } from "@/lib/account-deletion-service";
import { getSessionUser } from "@/lib/api-session";
import { verifyPassword } from "@/lib/auth";
import { CUSTOMER_ACCOUNT_RETENTION_NOTICE } from "@/lib/customer-account-copy";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { safeLog } from "@/lib/security/safe-logger";
import { cookieName } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedRoles = ["CUSTOMER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"] as const;
type AllowedRole = (typeof allowedRoles)[number];

function isAllowedRole(role: Role): role is AllowedRole {
  return (allowedRoles as readonly Role[]).includes(role);
}

export async function DELETE(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAllowedRole(session.role)) {
    return NextResponse.json(
      { error: "Owners must use business deletion. Administrator and support identities cannot use app deletion." },
      { status: 403 }
    );
  }

  const ip = getClientIp(request);
  const bucket = await rateLimit(`personal-account-delete:${session.id}:${ip}`, 3, 30 * 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many deletion attempts. Try again later." }, { status: 429 });
  }
  const parsed = personalAccountDeletionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, passwordHash: true, emailVerifiedAt: true }
  });
  if (!user || !isAllowedRole(user.role) || !user.emailVerifiedAt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  try {
    const completed = await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const scope = user.role === "CUSTOMER" ? "CUSTOMER" : "STAFF";
        const retentionNotice =
          user.role === "CUSTOMER" ? CUSTOMER_ACCOUNT_RETENTION_NOTICE : STAFF_ACCOUNT_RETENTION_NOTICE;
        const deletionRequest = await tx.accountDeletionRequest.create({
          data: {
            scope,
            status: "PROCESSING",
            requesterUserId: user.id,
            retentionNoticeVersion: ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
            retentionNotice,
            scheduledFor: now,
            processingAt: now,
            verifiedAt: now
          },
          select: { id: true }
        });
        const deleted = await deletePersonalAccountWithClient(tx, {
          userId: user.id,
          allowedRoles,
          requestId: deletionRequest.id,
          auditContext: { initiation: "authenticated", ip }
        });
        return tx.accountDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            ...accountDeletionRetentionSchedule(now),
            result: deleted.result
          },
          select: {
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
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const response = NextResponse.json(
      { accountDeletion: accountDeletionPayload(completed) },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return response;
  } catch (error) {
    safeLog("error", "Personal account deletion failed", { error, userId: user.id });
    return NextResponse.json(
      { error: "Account deletion failed. No partial deletion was committed." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
