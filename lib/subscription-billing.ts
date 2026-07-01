import type { PlatformSubscriptionCoupon, SubscriptionPlan } from "@prisma/client";
import { buildSubscriptionBillingBreakdown, money, normalizeCouponCode, subscriptionPlanAmounts } from "@/lib/billing";
import { validateSubscriptionCoupon } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";

export type SubscriptionBillingPreview = {
  plan: SubscriptionPlan;
  coupon: {
    id: string;
    code: string;
    description: string | null;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    maxDiscountAmount: number | null;
  } | null;
  upgradeCredit: {
    amount: number;
    subscriptionId: string;
    plan: SubscriptionPlan;
  } | null;
  breakdown: {
    subtotal: number;
    discount: number;
    upgradeCredit: number;
    taxableAmount: number;
    gstRateBps: number;
    gstAmount: number;
    total: number;
  };
};

type UpgradeCreditSource = {
  id: string;
  plan: SubscriptionPlan;
  amount: unknown;
  subtotalAmount: unknown;
  discountAmount: unknown;
  taxableAmount: unknown;
};

function serializeSubscriptionCoupon(coupon: PlatformSubscriptionCoupon | null): SubscriptionBillingPreview["coupon"] {
  if (!coupon) return null;

  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount)
  };
}

function subscriptionTaxableCredit(subscription: UpgradeCreditSource) {
  const taxableAmount = Number(subscription.taxableAmount);
  if (taxableAmount > 0) return money(taxableAmount);

  const subtotalAmount = Number(subscription.subtotalAmount);
  const discountAmount = Number(subscription.discountAmount);
  if (subtotalAmount > 0) return money(Math.max(0, subtotalAmount - discountAmount));

  return money(Number(subscription.amount));
}

async function getUpgradeCredit(input: {
  businessId: string;
  plan: SubscriptionPlan;
}): Promise<SubscriptionBillingPreview["upgradeCredit"]> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true
    }
  });

  if (!business || business.subscriptionStatus !== "ACTIVE") return null;
  if (business.subscriptionPlan === input.plan) return null;
  if (subscriptionPlanAmounts[input.plan] <= subscriptionPlanAmounts[business.subscriptionPlan]) return null;

  const currentSubscription = await prisma.subscription.findFirst({
    where: {
      businessId: input.businessId,
      plan: business.subscriptionPlan,
      status: "ACTIVE",
      endDate: { gt: new Date() }
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      plan: true,
      amount: true,
      subtotalAmount: true,
      discountAmount: true,
      taxableAmount: true
    }
  });
  if (!currentSubscription) return null;

  const amount = money(Math.min(subscriptionPlanAmounts[input.plan], subscriptionTaxableCredit(currentSubscription)));
  if (amount <= 0) return null;

  return {
    amount,
    subscriptionId: currentSubscription.id,
    plan: currentSubscription.plan
  };
}

export async function getSubscriptionBillingPreview(input: {
  businessId: string;
  plan: SubscriptionPlan;
  couponCode?: string | null;
}): Promise<{ ok: true; preview: SubscriptionBillingPreview; couponRecord: PlatformSubscriptionCoupon | null } | { ok: false; error: string }> {
  const couponCode = normalizeCouponCode(input.couponCode);
  const coupon = couponCode
    ? await prisma.platformSubscriptionCoupon.findUnique({ where: { code: couponCode } })
    : null;

  if (couponCode) {
    const validation = validateSubscriptionCoupon(coupon, input.plan);
    if (!validation.ok) return { ok: false, error: validation.error };
  }

  const upgradeCredit = await getUpgradeCredit({ businessId: input.businessId, plan: input.plan });
  const breakdown = buildSubscriptionBillingBreakdown({
    plan: input.plan,
    coupon,
    upgradeCreditAmount: upgradeCredit?.amount ?? 0
  });

  return {
    ok: true,
    couponRecord: coupon,
    preview: {
      plan: input.plan,
      coupon: serializeSubscriptionCoupon(coupon),
      upgradeCredit,
      breakdown
    }
  };
}
