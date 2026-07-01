import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCouponCode, subscriptionPeriodEnd } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { billingCheckoutSchema } from "@/lib/validations";
import { createSubscriptionPaymentRequest } from "@/services/subscription-payments";
import { buildSubscriptionCheckoutPayload } from "@/lib/subscription-checkout-payload";
import { getSubscriptionBillingPreview } from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";

function checkoutId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function publicAppUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:billing:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = billingCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: {
      id: true,
      name: true,
      ownerName: true,
      email: true,
      phone: true,
      subscriptionPlan: true,
      subscriptionStatus: true
    }
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const id = checkoutId();
  const startDate = new Date();
  const couponCode = normalizeCouponCode(parsed.data.couponCode);
  const billingGstin = parsed.data.billingGstin ?? null;
  const billingPreview = await getSubscriptionBillingPreview({
    businessId: business.id,
    plan: parsed.data.plan,
    couponCode
  });
  if (!billingPreview.ok) {
    return NextResponse.json({ error: billingPreview.error }, { status: 400 });
  }
  const { breakdown } = billingPreview.preview;
  const amount = breakdown.total;
  const referenceId = `SUB-${id.slice(-18).toUpperCase()}`.slice(0, 40);

  const existingCheckout = await prisma.subscription.findFirst({
    where: {
      businessId: business.id,
      plan: parsed.data.plan,
      couponCode,
      status: "PAST_DUE",
      paymentProvider: "CASHFREE",
      paymentStatus: "PENDING",
      billingGstin,
      upgradeCreditAmount: breakdown.upgradeCredit,
      upgradedFromSubscriptionId: billingPreview.preview.upgradeCredit?.subscriptionId ?? null,
      paymentRequestExpiresAt: { gt: new Date() },
      paymentRequestUrl: { not: null }
    },
    orderBy: { createdAt: "desc" }
  });

  if (existingCheckout) {
    return NextResponse.json(await buildSubscriptionCheckoutPayload(existingCheckout));
  }

  let paymentRequest: Awaited<ReturnType<typeof createSubscriptionPaymentRequest>>;
  try {
    paymentRequest = await createSubscriptionPaymentRequest({
      appUrl: publicAppUrl(request),
      amount,
      referenceId,
      subscriptionId: id,
      businessId: business.id,
      businessName: business.name,
      plan: parsed.data.plan,
      customerName: business.ownerName,
      customerPhone: business.phone,
      customerEmail: business.email
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create subscription checkout." },
      { status: 502 }
    );
  }

  let subscription: Awaited<ReturnType<typeof prisma.subscription.create>>;
  try {
    subscription = await prisma.$transaction(async (tx) => {
      if (billingPreview.couponRecord) {
        const couponClaim = await tx.platformSubscriptionCoupon.updateMany({
          where: {
            id: billingPreview.couponRecord.id,
            isActive: true,
            OR: [
              { redemptionLimit: null },
              { redeemedCount: { lt: billingPreview.couponRecord.redemptionLimit ?? 0 } }
            ]
          },
          data: { redeemedCount: { increment: 1 } }
        });
        if (couponClaim.count === 0) {
          throw new Error("This subscription coupon has reached its usage limit.");
        }
      }

      return tx.subscription.create({
        data: {
          id,
          invoiceNumber: `SUBINV-${id.slice(-12).toUpperCase()}`,
          businessId: business.id,
          plan: parsed.data.plan,
          subtotalAmount: breakdown.subtotal,
          discountAmount: breakdown.discount,
          upgradeCreditAmount: breakdown.upgradeCredit,
          upgradedFromSubscriptionId: billingPreview.preview.upgradeCredit?.subscriptionId ?? null,
          taxableAmount: breakdown.taxableAmount,
          gstRateBps: breakdown.gstRateBps,
          gstAmount: breakdown.gstAmount,
          billingGstin,
          couponCode,
          subscriptionCouponId: billingPreview.couponRecord?.id ?? null,
          amount,
          status: "PAST_DUE",
          paymentStatus: "PENDING",
          paymentProvider: paymentRequest.provider,
          cashfreeOrderId: paymentRequest.cashfreeOrderId,
          cashfreeCfOrderId: paymentRequest.cashfreeCfOrderId,
          cashfreePaymentSessionId: paymentRequest.cashfreePaymentSessionId,
          cashfreeOrderStatus: paymentRequest.status,
          paymentRequestUrl: paymentRequest.paymentRequestUrl,
          paymentRequestExpiresAt: new Date(paymentRequest.expiresAt),
          startDate,
          endDate: subscriptionPeriodEnd(startDate)
        }
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "This subscription coupon has reached its usage limit.") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  await writeAuditLog({
    userId: session.id,
    businessId: business.id,
    action: "SUBSCRIPTION_CHECKOUT_CREATED",
    entity: "Subscription",
    entityId: subscription.id,
    metadata: {
      plan: subscription.plan,
      amount,
      subtotalAmount: breakdown.subtotal,
      discountAmount: breakdown.discount,
      upgradeCreditAmount: breakdown.upgradeCredit,
      upgradedFromSubscriptionId: billingPreview.preview.upgradeCredit?.subscriptionId ?? null,
      taxableAmount: breakdown.taxableAmount,
      gstAmount: breakdown.gstAmount,
      gstRateBps: breakdown.gstRateBps,
      billingGstin,
      couponCode,
      paymentProvider: paymentRequest.provider,
      paymentRequestId: paymentRequest.paymentRequestId,
      paymentRequestStatus: paymentRequest.status
    }
  });

  return NextResponse.json({
    ...(await buildSubscriptionCheckoutPayload(subscription)),
    paymentRequestId: paymentRequest.paymentRequestId
  });
}
