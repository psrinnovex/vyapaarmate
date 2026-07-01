import { NextResponse } from "next/server";
import { reconcileAbandonedCashfreePayments } from "@/services/payment-reconciliation";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handlePaymentReconciliation(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcileAbandonedCashfreePayments();
  return NextResponse.json(result);
}

export function GET(request: Request) {
  return handlePaymentReconciliation(request);
}

export function POST(request: Request) {
  return handlePaymentReconciliation(request);
}
