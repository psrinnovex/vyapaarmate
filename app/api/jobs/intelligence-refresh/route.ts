import { NextResponse } from "next/server";
import { refreshBusinessIntelligence } from "@/lib/business-intelligence-materialization";
import { requireCronRequest } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function boundedLimit(value: string | null) {
  const parsed = Number(value ?? 5);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(25, Math.max(1, Math.floor(parsed)));
}

async function handleIntelligenceRefresh(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const result = await refreshBusinessIntelligence({
    businessId: url.searchParams.get("businessId"),
    limit: boundedLimit(url.searchParams.get("limit"))
  });

  return NextResponse.json(result, { status: result.failed.length || result.deferred.length ? 207 : 200 });
}

export function GET(request: Request) {
  return handleIntelligenceRefresh(request);
}

export function POST(request: Request) {
  return handleIntelligenceRefresh(request);
}
