import { NextResponse } from "next/server";
import { applyCashfreePayoutWebhookEvent } from "@/services/business-wallet";
import {
  extractCashfreePayoutWebhookEvent,
  verifyCashfreePayoutWebhookSignature
} from "@/services/cashfree-payouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function signatureFrom(request: Request, payload: unknown) {
  const headerSignature =
    request.headers.get("x-webhook-signature") ??
    request.headers.get("x-cashfree-signature") ??
    request.headers.get("x-cf-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("cashfree-signature") ??
    request.headers.get("x-cashfree-payout-signature");

  if (headerSignature) return headerSignature.trim();
  if (isObject(payload)) return stringField(payload.signature);
  return null;
}

function timestampFrom(request: Request) {
  return (
    request.headers.get("x-webhook-timestamp") ??
    request.headers.get("x-cashfree-timestamp") ??
    request.headers.get("x-timestamp")
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Cashfree payout webhook body" }, { status: 400 });
  }

  const signature = signatureFrom(request, payload);
  if (!verifyCashfreePayoutWebhookSignature({ rawBody, payload, signature, timestamp: timestampFrom(request) })) {
    return NextResponse.json({ error: "Invalid Cashfree payout webhook signature" }, { status: 401 });
  }

  const event = extractCashfreePayoutWebhookEvent(payload);
  const result = await applyCashfreePayoutWebhookEvent(event);

  return NextResponse.json({
    received: true,
    event: {
      eventType: event.eventType,
      transferId: event.transferId,
      cfTransferId: event.cfTransferId,
      status: event.status,
      statusCode: event.statusCode
    },
    result
  });
}
