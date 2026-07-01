import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { getDashboardLivePayload, LiveDataNotFoundError } from "@/lib/live-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBusinessSession("business:overview:read");
  if (auth.response) return auth.response;
  const { session } = auth;

  try {
    return NextResponse.json(await getDashboardLivePayload(session.businessId));
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Dashboard live data unavailable" }, { status: 503 });
  }
}
