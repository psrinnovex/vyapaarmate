import type { PlatformSubscriptionCoupon, SubscriptionPlan } from "@prisma/client";
import {
  buildSubscriptionBillingBreakdown,
  money,
  normalizeCouponCode,
  subscriptionLaunchPlanAmounts,
  subscriptionPlanAmounts
} from "@/lib/billing";
import { validateSubscriptionCoupon } from "@/lib/coupons";
import {
  isBengaluruOfferLocation,
  launchBusinessLocationError,
  launchMarketRestricted,
  launchOffer
} from "@/lib/launch-policy";
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
  promotion: {
    code: string;
    name: string;
    discountPercent: number;
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

type BillingBusiness = {
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: string;
  city: string;
  state: string;
  latitude: unknown;
  longitude: unknown;
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

export function cappedSubscriptionUpgradeCredit(input: {
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  paidTaxableAmount: number;
  promotionActive: boolean;
}) {
  const currentPlanValue = input.promotionActive
    ? subscriptionLaunchPlanAmounts[input.currentPlan]
    : subscriptionPlanAmounts[input.currentPlan];

  return money(
    Math.min(
      subscriptionPlanAmounts[input.targetPlan],
      currentPlanValue,
      Math.max(0, input.paidTaxableAmount)
    )
  );
}

async function getUpgradeCredit(input: {
  businessId: string;
  plan: SubscriptionPlan;
  business: BillingBusiness;
  promotionActive: boolean;
}): Promise<SubscriptionBillingPreview["upgradeCredit"]> {
  if (input.business.subscriptionStatus !== "ACTIVE") return null;
  if (input.business.subscriptionPlan === input.plan) return null;
  if (subscriptionPlanAmounts[input.plan] <= subscriptionPlanAmounts[input.business.subscriptionPlan]) return null;

  const currentSubscription = await prisma.subscription.findFirst({
    where: {
      businessId: input.businessId,
      plan: input.business.subscriptionPlan,
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

  const amount = cappedSubscriptionUpgradeCredit({
    currentPlan: currentSubscription.plan,
    targetPlan: input.plan,
    paidTaxableAmount: subscriptionTaxableCredit(currentSubscription),
    promotionActive: input.promotionActive
  });
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
  billingGstin?: string | null;
}): Promise<{ ok: true; preview: SubscriptionBillingPreview; couponRecord: PlatformSubscriptionCoupon | null } | { ok: false; error: string }> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true
    }
  });
  if (!business) return { ok: false, error: "Business not found." };

  const marketError = launchBusinessLocationError(business, { requireCoordinates: true });
  if (launchMarketRestricted && marketError) return { ok: false, error: marketError };

  const promotionActive = launchOffer.enabled && isBengaluruOfferLocation(business);
  const promotion = promotionActive
    ? {
        code: launchOffer.code,
        name: launchOffer.name,
        discountPercent: launchOffer.discountPercent
      }
    : null;
  const couponCode = normalizeCouponCode(input.couponCode);
  if (promotion && couponCode) {
    return { ok: false, error: "Subscription coupons cannot be combined with the Bengaluru launch offer." };
  }
  const coupon = couponCode
    ? await prisma.platformSubscriptionCoupon.findUnique({ where: { code: couponCode } })
    : null;

  if (couponCode) {
    const validation = validateSubscriptionCoupon(coupon, input.plan);
    if (!validation.ok) return { ok: false, error: validation.error };
  }

  const upgradeCredit = await getUpgradeCredit({
    businessId: input.businessId,
    plan: input.plan,
    business,
    promotionActive
  });
  const breakdown = buildSubscriptionBillingBreakdown({
    plan: input.plan,
    coupon,
    promotion: promotion
      ? { discountType: "PERCENTAGE", discountValue: promotion.discountPercent }
      : null,
    upgradeCreditAmount: upgradeCredit?.amount ?? 0,
    billingGstin: input.billingGstin
  });

  return {
    ok: true,
    couponRecord: coupon,
    preview: {
      plan: input.plan,
      coupon: serializeSubscriptionCoupon(coupon),
      promotion,
      upgradeCredit,
      breakdown
    }
  };
}
