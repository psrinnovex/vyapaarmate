import { NextResponse } from "next/server";
import {
  creditMissingGatewayWalletEntries,
  processAutomaticCashfreePayouts,
  reconcileProcessingCashfreePayouts,
  releaseProviderSettledWalletCredits
} from "@/services/business-wallet";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleWalletReconciliation(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [credits, releases] = await Promise.all([
    creditMissingGatewayWalletEntries(),
    releaseProviderSettledWalletCredits()
  ]);
  const [automaticPayouts, payoutReconciliation] = await Promise.all([
    processAutomaticCashfreePayouts(),
    reconcileProcessingCashfreePayouts()
  ]);

  return NextResponse.json({
    recoveredMissingWalletCredits: credits.credited,
    checkedCompletedGatewayPayments: credits.checked,
    releasedForPayout: releases.released,
    checkedPendingProviderSettlements: releases.checked,
    automaticPayouts,
    payoutReconciliation
  });
}

export async function GET(request: Request) {
  return handleWalletReconciliation(request);
}

export async function POST(request: Request) {
  return handleWalletReconciliation(request);
}
