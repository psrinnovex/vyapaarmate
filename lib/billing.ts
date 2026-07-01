import type { CouponDiscountType, SubscriptionPlan } from "@prisma/client";

export const subscriptionPlanAmounts: Record<SubscriptionPlan, number> = {
  STARTER: 1499,
  PRO: 2999
};

export function formatSubscriptionPlan(plan: SubscriptionPlan | string) {
  return plan
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function subscriptionPeriodEnd(startDate: Date) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);
  return endDate;
}

export type DiscountInput = {
  discountType: CouponDiscountType | "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number | string | { toString(): string };
  maxDiscountAmount?: number | string | { toString(): string } | null;
};

export type BillingBreakdown = {
  subtotal: number;
  discount: number;
  upgradeCredit: number;
  taxableAmount: number;
  gstRateBps: number;
  gstAmount: number;
  total: number;
};

export function normalizeCouponCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return code || null;
}

export function money(value: number) {
  return Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

type MoneyValue = number | string | { toString(): string };

export function paidSubscriptionAmount(subscription: { amount?: MoneyValue | null } | null | undefined) {
  return money(Number(subscription?.amount ?? 0));
}

export function sumPaidSubscriptionAmounts(subscriptions: Iterable<{ amount?: MoneyValue | null }>) {
  let total = 0;
  for (const subscription of subscriptions) {
    total += paidSubscriptionAmount(subscription);
  }
  return money(total);
}

export function subscriptionGstRateBps() {
  const configured = Number(process.env.SUBSCRIPTION_GST_RATE_BPS ?? 1800);
  if (!Number.isFinite(configured)) return 1800;
  return Math.max(0, Math.min(10000, Math.round(configured)));
}

export function orderGstRateBps() {
  const configured = Number(process.env.ORDER_GST_RATE_BPS ?? 1800);
  if (!Number.isFinite(configured)) return 1800;
  return Math.max(0, Math.min(10000, Math.round(configured)));
}

export function calculateDiscount(amount: number, coupon: DiscountInput | null | undefined) {
  const base = money(amount);
  if (!coupon || base <= 0) return 0;

  const discountValue = Math.max(0, Number(coupon.discountValue));
  const rawDiscount =
    coupon.discountType === "PERCENTAGE"
      ? (base * Math.min(100, discountValue)) / 100
      : discountValue;
  const cap = coupon.maxDiscountAmount === null || coupon.maxDiscountAmount === undefined
    ? rawDiscount
    : Math.max(0, Number(coupon.maxDiscountAmount));

  return money(Math.min(base, rawDiscount, cap));
}

export function buildSubscriptionBillingBreakdown(input: {
  plan: SubscriptionPlan;
  coupon?: DiscountInput | null;
  upgradeCreditAmount?: number;
  gstRateBps?: number;
}): BillingBreakdown {
  const subtotal = money(subscriptionPlanAmounts[input.plan]);
  const discount = calculateDiscount(subtotal, input.coupon);
  const upgradeCredit = money(Math.min(Math.max(0, input.upgradeCreditAmount ?? 0), Math.max(0, subtotal - discount)));
  const taxableAmount = money(subtotal - discount - upgradeCredit);
  const gstRateBps = Math.max(0, Math.min(10000, Math.round(input.gstRateBps ?? subscriptionGstRateBps())));
  const gstAmount = money((taxableAmount * gstRateBps) / 10000);

  return {
    subtotal,
    discount,
    upgradeCredit,
    taxableAmount,
    gstRateBps,
    gstAmount,
    total: money(taxableAmount + gstAmount)
  };
}
