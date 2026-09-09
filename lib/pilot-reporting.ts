type Money = number | string | { toString(): string };

export function recurringSubscriptionValue(subscription: {
  subtotalAmount?: Money | null;
  discountAmount?: Money | null;
  amount: Money;
  gstAmount?: Money | null;
  upgradeCreditAmount?: Money | null;
}) {
  const subtotal = Number(subscription.subtotalAmount ?? 0);
  const value = subtotal > 0
    ? subtotal - Number(subscription.discountAmount ?? 0)
    : Number(subscription.amount) - Number(subscription.gstAmount ?? 0) + Number(subscription.upgradeCreditAmount ?? 0);
  return Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

export function weeklyRepeatUseRate(activeInBothWeeks: number, activeInPreviousWeek: number) {
  if (activeInPreviousWeek === 0) return null;
  return Math.round(activeInBothWeeks / activeInPreviousWeek * 1000) / 10;
}
