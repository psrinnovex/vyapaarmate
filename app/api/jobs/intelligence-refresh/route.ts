import { NextResponse } from "next/server";
import { refreshBusinessIntelligence } from "@/lib/business-intelligence-materialization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function boundedLimit(value: string | null) {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

async function handleIntelligenceRefresh(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = await refreshBusinessIntelligence({
    businessId: url.searchParams.get("businessId"),
    limit: boundedLimit(url.searchParams.get("limit"))
  });

  return NextResponse.json(result, { status: result.failed.length ? 207 : 200 });
}

export function GET(request: Request) {
  return handleIntelligenceRefresh(request);
}

export function POST(request: Request) {
  return handleIntelligenceRefresh(request);
}
