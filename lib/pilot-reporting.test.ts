import assert from "node:assert/strict";
import test from "node:test";
import { recurringSubscriptionValue, weeklyRepeatUseRate } from "./pilot-reporting";

test("recurring subscription value excludes GST and one-off upgrade credits", () => {
  assert.equal(recurringSubscriptionValue({ subtotalAmount: 1499, discountAmount: 1199.2, amount: 353.76, gstAmount: 53.96 }), 299.8);
  assert.equal(recurringSubscriptionValue({ subtotalAmount: 2999, discountAmount: 0, amount: 2358.82, gstAmount: 359.82, upgradeCreditAmount: 1000 }), 2999);
  assert.equal(recurringSubscriptionValue({ amount: 1180, gstAmount: 180 }), 1000);
  assert.equal(recurringSubscriptionValue({ amount: 0, gstAmount: 0 }), 0);
});

test("weekly repeat use has an explicit denominator and no invented zero-cohort percentage", () => {
  assert.equal(weeklyRepeatUseRate(0, 0), null);
  assert.equal(weeklyRepeatUseRate(2, 5), 40);
  assert.equal(weeklyRepeatUseRate(0, 5), 0);
});
