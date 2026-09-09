import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import { hasPermission } from "@/lib/rbac";

test("managers can record business cash payment collection", () => {
  assert.equal(hasPermission(Role.MANAGER, "business:payments:read"), true);
  assert.equal(hasPermission(Role.MANAGER, "business:payments:write"), true);
});

test("managers can operate appointment providers and availability", () => {
  assert.equal(hasPermission(Role.MANAGER, "business:appointments:manage"), true);
});

test("only owners have business billing write access", () => {
  assert.equal(hasPermission(Role.OWNER, "business:billing:write"), true);
  assert.equal(hasPermission(Role.SUPER_ADMIN, "business:billing:write"), false);
  assert.equal(hasPermission(Role.SUPPORT_AGENT, "business:billing:write"), false);
  assert.equal(hasPermission(Role.CUSTOMER, "business:billing:write"), false);
  assert.equal(hasPermission(Role.MANAGER, "business:billing:write"), false);
  assert.equal(hasPermission(Role.KITCHEN_STAFF, "business:billing:write"), false);
  assert.equal(hasPermission(Role.DELIVERY_STAFF, "business:billing:write"), false);
});

test("order-only staff cannot write payment records", () => {
  assert.equal(hasPermission(Role.KITCHEN_STAFF, "business:payments:write"), false);
  assert.equal(hasPermission(Role.DELIVERY_STAFF, "business:payments:write"), false);
});
