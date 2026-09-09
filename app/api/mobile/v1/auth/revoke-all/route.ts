import { NextResponse } from "next/server";
import { getMobileRequestSession } from "@/lib/api-session";
import { verifyPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revokeAllMobileSessions } from "@/lib/mobile-auth";
import { mobileRevokeAllSchema } from "@/lib/mobile-auth-policy";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" }
  });
}

export async function POST(request: Request) {
  const authenticated = await getMobileRequestSession();
  if (!authenticated) return json({ error: "invalid_token" }, 401);

  const bucket = await rateLimit(
    `mobile-revoke-all:${authenticated.user.id}:${getClientIp(request)}`,
    5,
    15 * 60_000
  );
  if (!bucket.allowed) return json({ error: "temporarily_unavailable" }, 429);

  const parsed = mobileRevokeAllSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  const user = await prisma.user.findUnique({
    where: { id: authenticated.user.id },
    select: { passwordHash: true }
  });
  if (!user || !(await verifyPassword(parsed.data.current_password, user.passwordHash))) {
    return json({ error: "invalid_credentials" }, 400);
  }

  const revoked = await revokeAllMobileSessions(authenticated.user.id, "user_revoke_all");
  await writeAuditLog({
    userId: authenticated.user.id,
    businessId: authenticated.user.businessId,
    action: "MOBILE_ALL_SESSIONS_REVOKED",
    entity: "User",
    entityId: authenticated.user.id,
    metadata: { revoked }
  });
  return json({ revoked: true, sessionCount: revoked });
}
