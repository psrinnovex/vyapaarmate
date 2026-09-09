import { createHash, randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import type { AccountDeletionScope } from "@prisma/client";
import {
  ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
  publicAccountDeletionRequestSchema
} from "@/lib/account-deletion";
import {
  createAccountDeletionEmailToken,
  retentionNoticeForDeletionScope,
  sendAccountDeletionVerificationEmail
} from "@/lib/account-deletion-public";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { safeLog } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const genericResponse = () =>
  NextResponse.json(
    {
      accepted: true,
      message: "If an eligible verified account matches that email, a single-use deletion link will be sent."
    },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );

function deletionScope(role: string): AccountDeletionScope | null {
  if (role === "CUSTOMER") return "CUSTOMER";
  if (role === "OWNER") return "BUSINESS";
  if (role === "MANAGER" || role === "KITCHEN_STAFF" || role === "DELIVERY_STAFF") return "STAFF";
  return null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const ip = getClientIp(request);
  const ipBucket = await rateLimit(`public-account-delete:${ip}`, 5, 30 * 60_000);
  if (!ipBucket.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const parsed = publicAccountDeletionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const emailHash = createHash("sha256").update(`public-account-deletion\0${parsed.data.email}`).digest("hex");
  const emailBucket = await rateLimit(`public-account-delete-email:${emailHash}`, 3, 60 * 60_000);
  if (!emailBucket.allowed) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 250 - (Date.now() - startedAt))));
    return genericResponse();
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true, role: true, businessId: true, emailVerifiedAt: true }
  });
  const scope = user ? deletionScope(user.role) : null;
  if (!user || !scope || !user.emailVerifiedAt || (scope === "BUSINESS" && !user.businessId)) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 250 - (Date.now() - startedAt))));
    return genericResponse();
  }

  try {
    const requestId = randomUUID();
    const token = createAccountDeletionEmailToken(requestId);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.accountDeletionRequest.updateMany({
        where: { requesterUserId: user.id, status: "AWAITING_VERIFICATION" },
        data: {
          status: "REJECTED",
          cancelledAt: now,
          verificationTokenHash: null,
          verificationExpiresAt: null
        }
      });
      await tx.accountDeletionRequest.create({
        data: {
          id: requestId,
          scope,
          status: "AWAITING_VERIFICATION",
          requesterUserId: user.id,
          businessId: scope === "BUSINESS" ? user.businessId : null,
          verificationTokenHash: token.hash,
          verificationExpiresAt: token.expiresAt,
          retentionNoticeVersion: ACCOUNT_DELETION_RETENTION_NOTICE_VERSION,
          retentionNotice: retentionNoticeForDeletionScope(scope),
          scheduledFor: now
        }
      });
    });

    after(async () => {
      try {
        await sendAccountDeletionVerificationEmail({
          email: user.email,
          name: user.name,
          token: token.raw,
          scope
        });
      } catch (error) {
        await prisma.accountDeletionRequest.updateMany({
          where: { id: requestId, status: "AWAITING_VERIFICATION" },
          data: {
            status: "REJECTED",
            cancelledAt: new Date(),
            verificationTokenHash: null,
            verificationExpiresAt: null
          }
        });
        safeLog("error", "Account deletion verification email failed", { error, userId: user.id });
      }
    });
  } catch (error) {
    safeLog("error", "Public account deletion request failed", { error, userId: user.id });
  }

  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 250 - (Date.now() - startedAt))));
  return genericResponse();
}
