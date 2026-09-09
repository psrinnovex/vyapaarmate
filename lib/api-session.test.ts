import assert from "node:assert/strict";
import test from "node:test";
import { cookieOnlySessionToken } from "@/lib/api-session";

test("mobile bearer credentials cannot authorize a browser authorization-code request", () => {
  assert.equal(cookieOnlySessionToken({ authorization: "Bearer mobile.jwt.value", cookieToken: "browser-cookie" }), null);
  assert.equal(cookieOnlySessionToken({ authorization: "Bearer mobile.jwt.value" }), null);
});

test("malformed or ambiguous authorization never falls back to the cookie", () => {
  assert.equal(cookieOnlySessionToken({ authorization: "Basic credentials", cookieToken: "browser-cookie" }), null);
  assert.equal(cookieOnlySessionToken({ authorization: "", cookieToken: "browser-cookie" }), null);
  assert.equal(cookieOnlySessionToken({ authorization: null, cookieToken: "browser-cookie" }), "browser-cookie");
});
