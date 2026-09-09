import { NextResponse } from "next/server";
import { accountDeletionPayload, publicAccountDeletionConfirmSchema } from "@/lib/account-deletion";
import {
  accountDeletionTokenMatches,
  confirmationForDeletionScope,
  parseAccountDeletionEmailToken
} from "@/lib/account-deletion-public";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const bucket = await rateLimit(`account-deletion-status:${getClientIp(request)}`, 20, 15 * 60_000);
  if (!bucket.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => null);
  const parsed = publicAccountDeletionConfirmSchema.pick({ token: true }).safeParse(body);
  const token = parsed.success ? parseAccountDeletionEmailToken(parsed.data.token) : null;
  if (!token) {
    return NextResponse.json({ error: "Deletion link is invalid or expired." }, { status: 400 });
  }
  const deletionRequest = await prisma.accountDeletionRequest.findUnique({
    where: { id: token.requestId },
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
      verificationTokenHash: true,
      verificationExpiresAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (
    !deletionRequest ||
    !deletionRequest.verificationTokenHash ||
    !deletionRequest.verificationExpiresAt ||
    deletionRequest.verificationExpiresAt <= new Date() ||
    !accountDeletionTokenMatches(deletionRequest.verificationTokenHash, token.hash)
  ) {
    return NextResponse.json({ error: "Deletion link is invalid or expired." }, { status: 400 });
  }
  return NextResponse.json(
    {
      accountDeletion: accountDeletionPayload(deletionRequest),
      requiredConfirmation: confirmationForDeletionScope(deletionRequest.scope)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
