import { NextResponse } from "next/server";
import { getMobileRequestSession, requireBusinessSession } from "@/lib/api-session";
import { getDashboardLivePayload, LiveDataNotFoundError, type DashboardLiveScope } from "@/lib/live-data";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const mobile = await getMobileRequestSession();
  if (!mobile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const scope: DashboardLiveScope = hasPermission(mobile.user.role, "business:overview:read") ? "overview" : "orders";
  const permission = scope === "overview" ? "business:overview:read" : "business:orders:read";
  const auth = await requireBusinessSession(permission);
  if (auth.response) return auth.response;

  try {
    const payload = await getDashboardLivePayload(auth.session.businessId, scope);
    return NextResponse.json(
      { scope, payload },
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
    );
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Business home unavailable" }, { status: 503 });
  }
}
