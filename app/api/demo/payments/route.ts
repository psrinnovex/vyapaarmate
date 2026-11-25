import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessSession } from "@/lib/api-session";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { applyCashfreePaymentEvent } from "@/services/cashfree-payment-events";

export const dynamic = "force-dynamic";

const demoPaymentSchema = z.object({
  kind: z.enum(["order", "subscription"]),
  id: z.string().trim().min(1).max(200),
  outcome: z.enum(["success", "failure"])
});

/**
 * DEMO_MODE only: settles a simulated Cashfree checkout. It feeds a synthetic
 * PAYMENT_SUCCESS / PAYMENT_FAILED event through the same handler the signed webhook
 * uses, so orders, subscriptions, wallets, audit logs and WhatsApp updates behave
 * exactly as they would with a real gateway.
 */
export async function POST(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bucket = await rateLimit(`demo-payment:${getClientIp(request)}`, 30, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many demo payments. Try again shortly." }, { status: 429 });
  }

  const parsed = demoPaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid demo payment request." }, { status: 400 });
  }
  const { kind, id, outcome } = parsed.data;

  let target: {
    cashfreeOrderId: string;
    cashfreeCfOrderId: string | null;
    amount: number;
    orderId: string | null;
    subscriptionId: string | null;
    returnUrl: string;
  } | null = null;

  if (kind === "order") {
    const order = await prisma.order.findUnique({
      where: { publicToken: id },
      select: {
        id: true,
        payment: { select: { provider: true, amount: true, cashfreeOrderId: true, cashfreeCfOrderId: true } }
      }
    });
    if (order?.payment?.provider === "CASHFREE" && order.payment.cashfreeOrderId) {
      target = {
        cashfreeOrderId: order.payment.cashfreeOrderId,
        cashfreeCfOrderId: order.payment.cashfreeCfOrderId,
        amount: Number(order.payment.amount),
        orderId: order.id,
        subscriptionId: null,
        returnUrl: `/order/${encodeURIComponent(id)}?checkout=return`
      };
    }
  } else {
    const auth = await requireBusinessSession("business:billing:write");
    if (auth.response) return auth.response;
    const subscription = await prisma.subscription.findFirst({
      where: { id, businessId: auth.session.businessId },
      select: { id: true, paymentProvider: true, amount: true, cashfreeOrderId: true, cashfreeCfOrderId: true }
    });
    if (subscription?.paymentProvider === "CASHFREE" && subscription.cashfreeOrderId) {
      target = {
        cashfreeOrderId: subscription.cashfreeOrderId,
        cashfreeCfOrderId: subscription.cashfreeCfOrderId,
        amount: Number(subscription.amount),
        orderId: null,
        subscriptionId: subscription.id,
        returnUrl: `/dashboard/billing/payment/${encodeURIComponent(subscription.id)}?checkout=return`
      };
    }
  }

  if (!target) {
    return NextResponse.json({ error: "No open demo checkout was found for this payment." }, { status: 404 });
  }

  const paid = outcome === "success";
  const result = await applyCashfreePaymentEvent(
    {
      eventType: paid ? "PAYMENT_SUCCESS_WEBHOOK" : "PAYMENT_FAILED_WEBHOOK",
      cashfreeOrderId: target.cashfreeOrderId,
      cashfreeCfOrderId: target.cashfreeCfOrderId,
      cashfreePaymentId: `demo_pay_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      orderStatus: paid ? "PAID" : "ACTIVE",
      paymentStatus: paid ? "SUCCESS" : "FAILED",
      paymentAmount: target.amount,
      paymentCurrency: "INR",
      taggedOrderId: target.orderId,
      taggedSubscriptionId: target.subscriptionId,
      failureReason: "Demo payment was declined on purpose.",
      customerPhone: null
    },
    "demo_checkout"
  );

  return NextResponse.json({ ...result, returnUrl: target.returnUrl });
}
