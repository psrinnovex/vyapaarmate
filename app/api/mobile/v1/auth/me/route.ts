import { NextResponse } from "next/server";
import { getMobileRequestSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authenticated = await getMobileRequestSession();
  if (!authenticated) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [session, deletionRequest] = await Promise.all([
    prisma.mobileSession.findUnique({
      where: { id: authenticated.mobileSessionId },
      select: {
        id: true,
        platform: true,
        deviceName: true,
        appVersion: true,
        absoluteExpiresAt: true,
        idleExpiresAt: true,
        createdAt: true
      }
    }),
    authenticated.user.businessId
      ? prisma.accountDeletionRequest.findFirst({
          where: {
            businessId: authenticated.user.businessId,
            scope: "BUSINESS",
            status: { in: ["REQUESTED", "PROCESSING"] }
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, scheduledFor: true, createdAt: true, retentionNotice: true }
        })
      : Promise.resolve(null)
  ]);

  return NextResponse.json(
    { user: authenticated.user, session, accountDeletion: deletionRequest },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}
