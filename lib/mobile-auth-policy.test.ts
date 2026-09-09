import assert from "node:assert/strict";
import test from "node:test";
import {
  isMobileAllowedRole,
  isValidPkcePair,
  MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS,
  MOBILE_CLIENT_ID,
  MOBILE_REDIRECT_URI,
  MOBILE_REFRESH_RETRY_GRACE_MS,
  mobileAuthorizationCodeGrantSchema,
  mobileRefreshGrantSchema,
  pkceChallenge
} from "@/lib/mobile-auth-policy";

test("mobile OAuth identity and access lifetime are fixed", () => {
  assert.equal(MOBILE_CLIENT_ID, "vyapaarmate-mobile");
  assert.equal(MOBILE_REDIRECT_URI, "com.pshrinnovex.vyapaarmate://oauth2redirect");
  assert.equal(MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS, 600);
  assert.equal(MOBILE_REFRESH_RETRY_GRACE_MS, 30_000);
});

test("mobile roles exclude administrator and support identities", () => {
  for (const role of ["CUSTOMER", "OWNER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"]) {
    assert.equal(isMobileAllowedRole(role), true);
  }
  assert.equal(isMobileAllowedRole("SUPER_ADMIN"), false);
  assert.equal(isMobileAllowedRole("SUPPORT_AGENT"), false);
});

test("PKCE requires the exact S256 verifier pair", () => {
  const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  const challenge = pkceChallenge(verifier);
  assert.equal(isValidPkcePair(verifier, challenge), true);
  assert.equal(isValidPkcePair(`${verifier}x`, challenge), false);
});

test("authorization code grant requires exact public client and redirect", () => {
  const base = {
    grant_type: "authorization_code",
    client_id: MOBILE_CLIENT_ID,
    redirect_uri: MOBILE_REDIRECT_URI,
    code: `vmac1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`,
    code_verifier: "a".repeat(43),
    platform: "IOS"
  };
  assert.equal(mobileAuthorizationCodeGrantSchema.safeParse(base).success, true);
  assert.equal(mobileAuthorizationCodeGrantSchema.safeParse({ ...base, redirect_uri: "https://evil.example" }).success, false);
});

test("refresh grant rejects an unexpected client", () => {
  assert.equal(
    mobileRefreshGrantSchema.safeParse({
      grant_type: "refresh_token",
      client_id: "other-client",
      refresh_token: `vmrt1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`
    }).success,
    false
  );
});
