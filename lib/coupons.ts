import type { BusinessCoupon, PlatformSubscriptionCoupon, SubscriptionPlan } from "@prisma/client";
import { buildSubscriptionBillingBreakdown, calculateDiscount, money, orderGstRateBps, type DiscountInput } from "@/lib/billing";

type CouponWindow = {
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  redemptionLimit: number | null;
  redeemedCount: number;
};

export type CouponValidationResult<T> =
  | { ok: true; coupon: T }
  | { ok: false; error: string };

function couponWindowError(coupon: CouponWindow, now = new Date()) {
  if (!coupon.isActive) return "This coupon is not active.";
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return "This coupon is not active yet.";
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) return "This coupon has expired.";
  if (coupon.redemptionLimit !== null && coupon.redeemedCount >= coupon.redemptionLimit) {
    return "This coupon has reached its usage limit.";
  }
  return null;
}

export function validateBusinessCoupon(
  coupon: BusinessCoupon | null,
  subtotal: number,
  now = new Date()
): CouponValidationResult<BusinessCoupon> {
  if (!coupon) return { ok: false, error: "Coupon code was not found for this business." };

  const windowError = couponWindowError(coupon, now);
  if (windowError) return { ok: false, error: windowError };

  const minimumOrderAmount = Number(coupon.minimumOrderAmount);
  if (money(subtotal) < minimumOrderAmount) {
    return { ok: false, error: `Add items worth at least INR ${minimumOrderAmount.toFixed(2)} to use this coupon.` };
  }

  if (calculateDiscount(subtotal, coupon) <= 0) {
    return { ok: false, error: "This coupon does not reduce the current total." };
  }

  return { ok: true, coupon };
}

export function validateSubscriptionCoupon(
  coupon: PlatformSubscriptionCoupon | null,
  plan: SubscriptionPlan,
  now = new Date()
): CouponValidationResult<PlatformSubscriptionCoupon> {
  if (!coupon) return { ok: false, error: "Subscription coupon code was not found." };

  const windowError = couponWindowError(coupon, now);
  if (windowError) return { ok: false, error: windowError };
  if (coupon.plan && coupon.plan !== plan) return { ok: false, error: "This coupon is not valid for the selected plan." };

  const breakdown = buildSubscriptionBillingBreakdown({ plan, coupon });
  if (breakdown.subtotal < Number(coupon.minimumAmount)) {
    return { ok: false, error: `This coupon requires a subscription amount of at least INR ${Number(coupon.minimumAmount).toFixed(2)}.` };
  }
  if (breakdown.discount <= 0) return { ok: false, error: "This coupon does not reduce the selected plan." };

  return { ok: true, coupon };
}

export function buildOrderCouponBreakdown(input: {
  subtotal: number;
  serviceFee: number;
  coupon?: DiscountInput | null;
  gstRateBps?: number;
}) {
  const subtotal = money(input.subtotal);
  const serviceFee = money(input.serviceFee);
  const discount = calculateDiscount(subtotal, input.coupon);
  const taxableAmount = money(subtotal - discount + serviceFee);
  const gstRateBps = Math.max(0, Math.min(10000, Math.round(input.gstRateBps ?? orderGstRateBps())));
  const gstAmount = money((taxableAmount * gstRateBps) / 10000);

  return {
    subtotal,
    serviceFee,
    discount,
    taxableAmount,
    gstRateBps,
    gstAmount,
    total: money(taxableAmount + gstAmount)
  };
}
