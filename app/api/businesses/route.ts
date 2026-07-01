import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { isValidCoordinate } from "@/lib/business-rules";
import { liveStream } from "@/lib/live-data";
import type { LiveChangePayload } from "@/lib/postgres-live-events";
import { getPublicBusinessListings } from "@/lib/public-businesses";

export const dynamic = "force-dynamic";

function optionalCoordinate(value: string | null) {
  if (!value) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const stream = searchParams.get("stream") === "1";
  const skipInitial = searchParams.get("skipInitial") === "1";
  const payload = () => Promise.resolve({ syncedAt: new Date().toISOString() });

  if (stream) {
    return new Response(
      liveStream("businesses", payload, request.signal, {
        sendInitialPayload: !skipInitial,
        changeFilter: businessListingChangeMatches
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

  const latitude = optionalCoordinate(searchParams.get("lat"));
  const longitude = optionalCoordinate(searchParams.get("lng"));
  const hasLatitude = searchParams.has("lat");
  const hasLongitude = searchParams.has("lng");
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length > 120) {
    return NextResponse.json({ error: "Search is too long. Try a shorter city, business, or item name." }, { status: 400 });
  }

  if (!hasLatitude || !hasLongitude) {
    return NextResponse.json({ error: "Turn on Location and allow access to show nearby businesses." }, { status: 400 });
  }

  if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
    return NextResponse.json({ error: "Location coordinates are invalid." }, { status: 400 });
  }

  const businesses = await getPublicBusinessListings({ latitude, longitude, query });
  return NextResponse.json({ businesses });
}

function businessListingChangeMatches(change: LiveChangePayload) {
  return ["Business", "BusinessImage", "BusinessServiceType", "MenuCategory", "MenuItem", "MenuItemImage"].includes(change.table);
}
