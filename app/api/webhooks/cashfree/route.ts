import { NextResponse } from "next/server";
import { apiError } from "@/lib/security/api-response";
import { safeLog } from "@/lib/security/safe-logger";
import { verifyCashfreeWebhookSignature } from "@/services/cashfree";
import { applyCashfreePaymentEvent, cashfreeWebhookData } from "@/services/cashfree-payment-events";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const verification = verifyCashfreeWebhookSignature(payload, signature, timestamp);

  if (!verification.verified) {
    safeLog("warn", "Rejected Cashfree webhook signature", {
      reason: verification.reason,
      hasSignature: Boolean(signature),
      hasTimestamp: Boolean(timestamp)
    });
    return apiError("Invalid webhook signature", 401);
  }

  let event: Record<string, unknown>;
  try {
    event = asRecord(JSON.parse(payload)) ?? {};
  } catch {
    return apiError("Invalid Cashfree webhook payload", 400);
  }

  return NextResponse.json(await applyCashfreePaymentEvent(cashfreeWebhookData(event), "cashfree_webhook"));
}
