import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidMobileOrderIdempotencyKey,
  mobileOrderBodyHash,
  mobileOrderKeyHash
} from "@/lib/mobile-order-idempotency";

test("mobile order idempotency keys are bounded and scoped to a user", () => {
  assert.equal(isValidMobileOrderIdempotencyKey("order-request-123456"), true);
  assert.equal(isValidMobileOrderIdempotencyKey("short"), false);
  assert.notEqual(
    mobileOrderKeyHash("user-a", "order-request-123456"),
    mobileOrderKeyHash("user-b", "order-request-123456")
  );
});

test("mobile order request hashes detect a reused key with a different body", () => {
  const first = mobileOrderBodyHash({ businessSlug: "cafe", items: [{ menuItemId: "one", quantity: 1 }] });
  const replay = mobileOrderBodyHash({ businessSlug: "cafe", items: [{ menuItemId: "one", quantity: 1 }] });
  const changed = mobileOrderBodyHash({ businessSlug: "cafe", items: [{ menuItemId: "one", quantity: 2 }] });
  assert.equal(first, replay);
  assert.notEqual(first, changed);
});
