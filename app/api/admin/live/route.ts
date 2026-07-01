import { NextResponse } from "next/server";
import { adminLiveChangeMatches, getAdminLivePayload, liveStream } from "@/lib/live-data";
import { getAdminSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";

  if (!stream) {
    try {
      return NextResponse.json(await getAdminLivePayload());
    } catch {
      return NextResponse.json({ error: "Admin live data unavailable" }, { status: 503 });
    }
  }

  return new Response(
    liveStream("admin", getAdminLivePayload, request.signal, {
      sendInitialPayload: !skipInitial,
      changeFilter: adminLiveChangeMatches
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    }
  );
}
