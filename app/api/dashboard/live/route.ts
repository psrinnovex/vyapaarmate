import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import {
  DASHBOARD_ORDERS_STREAM_REFRESH_INTERVAL_MS,
  dashboardLiveChangeMatches,
  getDashboardLivePayload,
  LiveDataNotFoundError,
  liveStream,
  type DashboardLiveScope
} from "@/lib/live-data";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dashboardScope(value: string | null): DashboardLiveScope {
  switch (value) {
    case "overview":
    case "orders":
    case "menu":
    case "payments":
    case "invoices":
    case "customers":
    case "coupons":
    case "campaigns":
    case "staff":
    case "reports":
    case "billing":
    case "settings":
      return value;
    default:
      return "full";
  }
}

function permissionForScope(scope: DashboardLiveScope) {
  switch (scope) {
    case "overview":
      return "business:overview:read";
    case "orders":
      return "business:orders:read";
    case "menu":
      return "business:menu:read";
    case "payments":
    case "invoices":
      return "business:payments:read";
    case "customers":
      return "business:customers:read";
    case "coupons":
      return "business:settings:write";
    case "reports":
      return "business:reports:read";
    case "settings":
      return "business:settings:write";
    case "billing":
      return "business:billing:read";
    case "staff":
      return "business:staff:manage";
    case "campaigns":
      return "business:customers:read";
    default:
      return "business:settings:write";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";
  const scope = dashboardScope(url.searchParams.get("scope"));
  const auth = await requireBusinessSession(permissionForScope(scope));
  if (auth.response) return auth.response;
  const { session } = auth;
  const includeBillingInvoices = scope === "invoices" && hasPermission(session.role, "business:billing:read");

  if (!stream) {
    try {
      return NextResponse.json(await getDashboardLivePayload(session.businessId, scope, { includeBillingInvoices }));
    } catch (error) {
      if (error instanceof LiveDataNotFoundError) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Dashboard live data unavailable" }, { status: 503 });
    }
  }

  return new Response(
    liveStream("dashboard", () => getDashboardLivePayload(session.businessId!, scope, { includeBillingInvoices }), request.signal, {
      sendInitialPayload: !skipInitial,
      refreshIntervalMs: scope === "orders" ? DASHBOARD_ORDERS_STREAM_REFRESH_INTERVAL_MS : undefined,
      changeFilter: (change) => dashboardLiveChangeMatches(session.businessId, scope, change)
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
