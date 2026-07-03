import { timingSafeEqual } from "node:crypto";
import { apiUnauthorized } from "@/lib/security/api-response";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isCronRequestAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const expected = `Bearer ${secret}`;
  const received = request.headers.get("authorization") ?? "";
  return safeEqual(received, expected);
}

export function requireCronRequest(request: Request) {
  return isCronRequestAuthorized(request) ? null : apiUnauthorized();
}
