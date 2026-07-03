import { NextResponse } from "next/server";
import { requireCronRequest } from "@/lib/security/cron";
import {
  processAutomaticCashfreePayouts,
  reconcileProcessingCashfreePayouts,
  releaseProviderSettledWalletCredits
} from "@/services/business-wallet";

export const dynamic = "force-dynamic";

async function handleAutomaticPayouts(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const releases = await releaseProviderSettledWalletCredits();
  const automaticPayouts = await processAutomaticCashfreePayouts();
  const payoutReconciliation = await reconcileProcessingCashfreePayouts();

  return NextResponse.json({
    releasedForPayout: releases.released,
    checkedPendingProviderSettlements: releases.checked,
    automaticPayouts,
    payoutReconciliation
  });
}

export async function GET(request: Request) {
  return handleAutomaticPayouts(request);
}

export async function POST(request: Request) {
  return handleAutomaticPayouts(request);
}
