import assert from "node:assert/strict";
import test from "node:test";
import {
  isMobileAuthorizationPath,
  mobileAuthorizationPortal,
  MOBILE_CLIENT_ID,
  MOBILE_REDIRECT_URI
} from "@/lib/mobile-client-contract";

function authorizationPath(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: MOBILE_CLIENT_ID,
    redirect_uri: MOBILE_REDIRECT_URI,
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
    state: "state-state-state-state",
    portal: "business",
    ...overrides
  });
  return `/api/mobile/v1/auth/authorize?${params}`;
}

test("recognizes only the complete first-party native authorization path", () => {
  assert.equal(mobileAuthorizationPortal(authorizationPath()), "business");
  assert.equal(mobileAuthorizationPortal(authorizationPath({ portal: "user" })), "user");
  assert.equal(isMobileAuthorizationPath(authorizationPath()), true);
});

test("rejects altered, external, incomplete, duplicated, and unexpected authorization input", () => {
  assert.equal(mobileAuthorizationPortal(`https://evil.example${authorizationPath()}`), null);
  assert.equal(mobileAuthorizationPortal(`//evil.example${authorizationPath()}`), null);
  assert.equal(mobileAuthorizationPortal(authorizationPath({ client_id: "other-client" })), null);
  assert.equal(mobileAuthorizationPortal(authorizationPath({ redirect_uri: "https://evil.example/callback" })), null);
  assert.equal(mobileAuthorizationPortal(authorizationPath({ code_challenge: "short" })), null);
  assert.equal(mobileAuthorizationPortal(authorizationPath({ state: "short" })), null);
  assert.equal(mobileAuthorizationPortal(`${authorizationPath()}&portal=user`), null);
  assert.equal(mobileAuthorizationPortal(`${authorizationPath()}&unexpected=value`), null);
});
