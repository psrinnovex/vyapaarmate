import assert from "node:assert/strict";
import test from "node:test";
import { effectiveSubscriptionStatus, hasCurrentPaidSubscription } from "@/lib/subscription-access";

const now = new Date("2026-07-27T06:00:00.000Z");

function period(overrides: Partial<{
  status: "ACTIVE" | "PAST_DUE";
  paymentStatus: "COMPLETED" | "PENDING";
  startDate: Date;
  endDate: Date;
}> = {}) {
  return {
    status: "ACTIVE" as const,
    paymentStatus: "COMPLETED" as const,
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    endDate: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides
  };
}

test("paid subscription access requires a completed active period containing the current instant", () => {
  assert.equal(hasCurrentPaidSubscription([period()], now), true);
  assert.equal(hasCurrentPaidSubscription([period({ paymentStatus: "PENDING" })], now), false);
  assert.equal(hasCurrentPaidSubscription([period({ status: "PAST_DUE" })], now), false);
  assert.equal(hasCurrentPaidSubscription([period({ startDate: now })], now), true);
  assert.equal(hasCurrentPaidSubscription([period({ endDate: now })], now), false);
});

test("stale denormalized ACTIVE status becomes PAST_DUE without a current paid period", () => {
  assert.equal(effectiveSubscriptionStatus("ACTIVE", [period()], now), "ACTIVE");
  assert.equal(effectiveSubscriptionStatus("ACTIVE", [period({ endDate: now })], now), "PAST_DUE");
  assert.equal(effectiveSubscriptionStatus("CANCELLED", [period()], now), "CANCELLED");
});
