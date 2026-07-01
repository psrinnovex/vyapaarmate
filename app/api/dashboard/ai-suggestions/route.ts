import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { getBusinessIntelligencePayload } from "@/lib/business-intelligence-data";
import { LiveDataNotFoundError, liveStream } from "@/lib/live-data";
import type { LiveChangePayload } from "@/lib/postgres-live-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const aiSuggestionTables = new Set([
  "AIInsight",
  "Business",
  "BusinessHealthSnapshot",
  "Customer",
  "CustomerIntelligenceScore",
  "DemandForecast",
  "MenuCategory",
  "MenuItem",
  "Order",
  "OrderItem",
  "Payment",
  "PaymentPriority"
]);

function aiSuggestionChangeMatches(businessId: string, change: LiveChangePayload) {
  if (!aiSuggestionTables.has(change.table)) return false;
  if (change.global) return true;
  return change.businessId === businessId;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";
  const auth = await requireBusinessSession("business:reports:read");
  if (auth.response) return auth.response;
  const { session } = auth;

  if (stream) {
    return new Response(
      liveStream("ai-suggestions", () => getBusinessIntelligencePayload(session.businessId), request.signal, {
        sendInitialPayload: !skipInitial,
        refreshIntervalMs: 30000,
        changeFilter: (change) => aiSuggestionChangeMatches(session.businessId, change)
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

  try {
    return NextResponse.json(await getBusinessIntelligencePayload(session.businessId));
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "AI suggestions are unavailable right now" }, { status: 503 });
  }
}
