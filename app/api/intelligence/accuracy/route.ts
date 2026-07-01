import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { getBusinessIntelligenceAccuracyReport } from "@/lib/business-intelligence-accuracy";
import { LiveDataNotFoundError } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function boundedBacktestDays(value: string | null) {
  const parsed = Number(value ?? 7);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(21, Math.max(3, Math.floor(parsed)));
}

export async function GET(request: Request) {
  const auth = await requireBusinessSession("business:reports:read");
  if (auth.response) return auth.response;

  const url = new URL(request.url);

  try {
    const report = await getBusinessIntelligenceAccuracyReport({
      businessId: auth.session.businessId,
      backtestDays: boundedBacktestDays(url.searchParams.get("days")),
      includeSamples: url.searchParams.get("includeSamples") === "1"
    });

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Intelligence accuracy report is unavailable right now" }, { status: 503 });
  }
}
