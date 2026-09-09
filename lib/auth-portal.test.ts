import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalPath, safeRoleRedirectPath, signInPathForPortal } from "./auth-portal";

test("login destinations reject browser-normalized external URLs", () => {
  for (const value of ["//outside.example", "/\\outside.example", "/\t/outside.example", "/\n/outside.example", "https://outside.example", "/%5coutside.example", "/%2foutside.example"]) {
    assert.equal(safeInternalPath(value), null, JSON.stringify(value));
    assert.equal(safeRoleRedirectPath(value, "CUSTOMER"), "/user");
  }
});

test("portal redirects enforce roles after dot-segment normalization", () => {
  assert.equal(safeRoleRedirectPath("/user/../admin", "CUSTOMER"), "/user");
  assert.equal(safeRoleRedirectPath("/dashboard/%2e%2e/admin", "OWNER"), "/dashboard");
  assert.equal(safeRoleRedirectPath("/support/../dashboard", "SUPPORT_AGENT"), "/support");
});

test("safe destinations preserve internal query strings and anchors", () => {
  assert.equal(safeInternalPath("/b/audit-business?category=Main%20Menu#cart"), "/b/audit-business?category=Main%20Menu#cart");
  assert.equal(signInPathForPortal("user", "/b/audit-business"), "/login?type=user&next=%2Fb%2Faudit-business");
});
