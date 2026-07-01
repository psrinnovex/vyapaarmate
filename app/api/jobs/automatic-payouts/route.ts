import { NextResponse } from "next/server";
import {
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

async function handleAutomaticPayouts(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
