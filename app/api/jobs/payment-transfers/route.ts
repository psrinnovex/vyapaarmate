import { NextResponse } from "next/server";
import { requireCronRequest } from "@/lib/security/cron";
import {
  creditMissingGatewayWalletEntries,
  processAutomaticCashfreePayouts,
  reconcileProcessingCashfreePayouts,
  releaseProviderSettledWalletCredits
} from "@/services/business-wallet";

export const dynamic = "force-dynamic";

async function handleWalletReconciliation(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

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
