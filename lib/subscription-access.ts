import type { PaymentStatus, Prisma, SubscriptionStatus } from "@prisma/client";

export function currentPaidSubscriptionWhere(now = new Date()): Prisma.SubscriptionWhereInput {
  return {
    status: "ACTIVE",
    paymentStatus: "COMPLETED",
    startDate: { lte: now },
    endDate: { gt: now }
  };
}

export type PaidSubscriptionPeriod = {
  status: SubscriptionStatus | string;
  paymentStatus: PaymentStatus | string;
  startDate: Date;
  endDate: Date;
};

export function isCurrentPaidSubscription(
  subscription: PaidSubscriptionPeriod,
  now = new Date()
) {
  return (
    subscription.status === "ACTIVE" &&
    subscription.paymentStatus === "COMPLETED" &&
    subscription.startDate.getTime() <= now.getTime() &&
    subscription.endDate.getTime() > now.getTime()
  );
}

export function hasCurrentPaidSubscription(
  subscriptions: Iterable<PaidSubscriptionPeriod>,
  now = new Date()
) {
  for (const subscription of subscriptions) {
    if (isCurrentPaidSubscription(subscription, now)) return true;
  }
  return false;
}

export function effectiveSubscriptionStatus(
  storedStatus: SubscriptionStatus,
  subscriptions: Iterable<PaidSubscriptionPeriod>,
  now = new Date()
): SubscriptionStatus {
  if (storedStatus !== "ACTIVE") return storedStatus;
  return hasCurrentPaidSubscription(subscriptions, now) ? "ACTIVE" : "PAST_DUE";
}
