import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { requireVerifiedCustomerAccount } from "@/lib/customer-account";
import {
  CUSTOMER_ACCOUNT_RETENTION_NOTICE,
  customerAccountDeletionSchema
} from "@/lib/customer-account-policy";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/security/api-response";
import { safeLog } from "@/lib/security/safe-logger";
import { parseJsonRequest } from "@/lib/security/validation";
import { cookieName } from "@/lib/session";
import { smsVerificationEnabled } from "@/services/sms";
import {
  ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
  accountDeletionRetentionSchedule
} from "@/lib/account-deletion";
import { deletePersonalAccountWithClient } from "@/lib/account-deletion-service";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const authorization = await requireVerifiedCustomerAccount();
  if ("response" in authorization) return authorization.response;

  const { user } = authorization;
  const ip = getClientIp(request);
  const bucket = await rateLimit(`customer-account-delete:${user.id}:${ip}`, 5, 15 * 60_000);
  if (!bucket.allowed) {
    return apiError("Too many account deletion attempts. Try again in a few minutes.", 429);
  }

  const parsed = await parseJsonRequest(request, customerAccountDeletionSchema);
  if (parsed.response) return parsed.response;

  const currentPasswordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!currentPasswordValid) {
    return apiError("Current password is incorrect.", 400);
  }

  try {
    const phoneVerificationRequired = smsVerificationEnabled();
    const deleted = await prisma.$transaction(
      async (tx) => {
        const current = await tx.user.findFirst({
          where: {
            id: user.id,
            role: "CUSTOMER",
            passwordHash: user.passwordHash,
            emailVerifiedAt: { not: null },
            ...(phoneVerificationRequired ? { phoneVerifiedAt: { not: null } } : {})
          },
          select: { id: true }
        });
        if (!current) throw new Error("ACCOUNT_CHANGED_DURING_DELETION");

        const now = new Date();
        const deletionRequest = await tx.accountDeletionRequest.create({
          data: {
            scope: "CUSTOMER",
            status: "PROCESSING",
            requesterUserId: user.id,
            retentionNoticeVersion: ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
            retentionNotice: CUSTOMER_ACCOUNT_RETENTION_NOTICE,
            scheduledFor: now,
            processingAt: now,
            verifiedAt: now
          },
          select: { id: true }
        });
        const result = await deletePersonalAccountWithClient(tx, {
          userId: user.id,
          allowedRoles: ["CUSTOMER"],
          requestId: deletionRequest.id,
          auditContext: { initiation: "authenticated", ip }
        });
        await tx.accountDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            ...accountDeletionRetentionSchedule(now),
            result: result.result
          }
        });
        return result.result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const response = NextResponse.json(
      {
        message: "Your VyapaarMate sign-in account and account profile were deleted.",
        retentionNotice: CUSTOMER_ACCOUNT_RETENTION_NOTICE,
        result: deleted
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set({
      name: cookieName,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0
    });

    return response;
  } catch (error) {
    safeLog("error", "Customer account deletion failed", { error, userId: user.id });
    return apiError("We could not delete your account. No account change was completed. Please try again.", 500);
  }
}
