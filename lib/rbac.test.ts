import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import { hasPermission } from "@/lib/rbac";

test("managers can record business cash payment collection", () => {
  assert.equal(hasPermission(Role.MANAGER, "business:payments:read"), true);
  assert.equal(hasPermission(Role.MANAGER, "business:payments:write"), true);
});

test("order-only staff cannot write payment records", () => {
  assert.equal(hasPermission(Role.KITCHEN_STAFF, "business:payments:write"), false);
  assert.equal(hasPermission(Role.DELIVERY_STAFF, "business:payments:write"), false);
});
