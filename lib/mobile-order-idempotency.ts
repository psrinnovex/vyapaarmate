import { createHash } from "node:crypto";

const idempotencyKeyPattern = /^[A-Za-z0-9._~-]{16,128}$/;

export function isValidMobileOrderIdempotencyKey(value: string | null) {
  return Boolean(value && idempotencyKeyPattern.test(value));
}

export function mobileOrderKeyHash(userId: string, key: string) {
  return createHash("sha256")
    .update("mobile-order-key\0")
    .update(userId)
    .update("\0")
    .update(key)
    .digest("hex");
}

export function mobileOrderBodyHash(value: unknown) {
  return createHash("sha256")
    .update("mobile-order-body\0")
    .update(JSON.stringify(value))
    .digest("hex");
}
