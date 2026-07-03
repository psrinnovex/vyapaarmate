import { NextResponse } from "next/server";
import { requireCronRequest } from "@/lib/security/cron";
import { reconcileAbandonedCashfreePayments } from "@/services/payment-reconciliation";

export const dynamic = "force-dynamic";

async function handlePaymentReconciliation(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const result = await reconcileAbandonedCashfreePayments();
  return NextResponse.json(result);
}

export function GET(request: Request) {
  return handlePaymentReconciliation(request);
}

export function POST(request: Request) {
  return handlePaymentReconciliation(request);
}
