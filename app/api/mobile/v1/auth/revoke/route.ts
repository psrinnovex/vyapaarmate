import { NextResponse } from "next/server";
import { getMobileRequestSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { revokeMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const authenticated = await getMobileRequestSession();
  if (!authenticated) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  await revokeMobileSession(authenticated.mobileSessionId);
  await writeAuditLog({
    userId: authenticated.user.id,
    businessId: authenticated.user.businessId,
    action: "MOBILE_SESSION_REVOKED",
    entity: "MobileSession",
    entityId: authenticated.mobileSessionId
  });

  return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
