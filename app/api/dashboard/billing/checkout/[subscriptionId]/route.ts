import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { expireSubscriptionPayment, syncCashfreeSubscriptionPayment } from "@/services/subscription-payments";
import { buildSubscriptionCheckoutPayload } from "@/lib/subscription-checkout-payload";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ subscriptionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:billing:read");
  if (auth.response) return auth.response;
  const { session } = auth;

  const { subscriptionId } = await context.params;
  let subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId: session.businessId },
    select: {
      id: true,
      businessId: true,
      plan: true,
      amount: true,
      subtotalAmount: true,
      discountAmount: true,
      upgradeCreditAmount: true,
      upgradedFromSubscriptionId: true,
      taxableAmount: true,
      gstRateBps: true,
      gstAmount: true,
      billingGstin: true,
      couponCode: true,
      status: true,
      paymentStatus: true,
      paymentProvider: true,
      paymentRequestUrl: true,
      paymentRequestExpiresAt: true,
      paidAt: true,
      cashfreePaymentId: true,
      invoiceNumber: true
    }
  });

  if (!subscription) {
    return NextResponse.json({ error: "Subscription checkout not found" }, { status: 404 });
  }

  if (subscription.paymentProvider === "CASHFREE" && subscription.paymentStatus !== "COMPLETED") {
    const syncResult = await syncCashfreeSubscriptionPayment(subscription.id).catch(() => null);
    if (syncResult?.updated) {
      const paymentState = "paymentState" in syncResult ? syncResult.paymentState : null;
      await writeAuditLog({
        userId: null,
        businessId: subscription.businessId,
        action: paymentState === "COMPLETED" ? "SUBSCRIPTION_PAYMENT_CONFIRMED" : "SUBSCRIPTION_PAYMENT_FAILED",
        entity: "Subscription",
        entityId: subscription.id,
        metadata: {
          paymentProvider: subscription.paymentProvider,
          paymentId: "paymentId" in syncResult ? syncResult.paymentId : null,
          providerStatus: "providerStatus" in syncResult ? syncResult.providerStatus : null,
          source: "cashfree_status_poll"
        }
      });
      subscription = await prisma.subscription.findFirst({
        where: { id: subscriptionId, businessId: session.businessId },
        select: {
          id: true,
          businessId: true,
          plan: true,
          amount: true,
          subtotalAmount: true,
          discountAmount: true,
          upgradeCreditAmount: true,
          upgradedFromSubscriptionId: true,
          taxableAmount: true,
          gstRateBps: true,
          gstAmount: true,
          billingGstin: true,
          couponCode: true,
          status: true,
          paymentStatus: true,
          paymentProvider: true,
          paymentRequestUrl: true,
          paymentRequestExpiresAt: true,
          paidAt: true,
          cashfreePaymentId: true,
          invoiceNumber: true
        }
      });
    }
  }

  if (!subscription) {
    return NextResponse.json({ error: "Subscription checkout not found" }, { status: 404 });
  }

  const expired = subscription.paymentStatus === "PENDING"
    && Boolean(subscription.paymentRequestExpiresAt && subscription.paymentRequestExpiresAt.getTime() <= Date.now());
  if (expired && await expireSubscriptionPayment(subscription.id)) {
    await writeAuditLog({
      userId: session.id,
      businessId: subscription.businessId,
      action: "SUBSCRIPTION_PAYMENT_EXPIRED",
      entity: "Subscription",
      entityId: subscription.id,
      metadata: { paymentProvider: subscription.paymentProvider }
    });
    subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, businessId: session.businessId },
      select: {
        id: true,
        businessId: true,
        plan: true,
        amount: true,
        subtotalAmount: true,
        discountAmount: true,
        upgradeCreditAmount: true,
        upgradedFromSubscriptionId: true,
        taxableAmount: true,
        gstRateBps: true,
        gstAmount: true,
        billingGstin: true,
        couponCode: true,
        status: true,
        paymentStatus: true,
        paymentProvider: true,
        paymentRequestUrl: true,
        paymentRequestExpiresAt: true,
        paidAt: true,
        cashfreePaymentId: true,
        invoiceNumber: true
      }
    });
  }

  if (!subscription) {
    return NextResponse.json({ error: "Subscription checkout not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...(await buildSubscriptionCheckoutPayload(subscription)),
    id: subscription.id,
    businessId: subscription.businessId,
    paidAt: subscription.paidAt?.toISOString() ?? null,
    cashfreePaymentId: subscription.cashfreePaymentId
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
