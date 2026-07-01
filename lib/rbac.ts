import type { Role } from "@prisma/client";
import type { SessionUser } from "./session";

const rolePermissions: Record<Role, string[]> = {
  SUPER_ADMIN: ["platform:*"],
  SUPPORT_AGENT: ["platform:support:*"],
  OWNER: ["business:*"],
  CUSTOMER: [],
  MANAGER: [
    "business:overview:read",
    "business:orders:*",
    "business:menu:*",
    "business:customers:*",
    "business:payments:read",
    "business:payments:write",
    "business:reports:read"
  ],
  KITCHEN_STAFF: ["business:orders:read", "business:orders:update"],
  DELIVERY_STAFF: ["business:orders:read", "business:orders:update"]
};

export function hasPermission(role: Role, permission: string) {
  return rolePermissions[role].some((allowed) => {
    if (allowed.endsWith(":*")) return permission.startsWith(allowed.replace(":*", ":"));
    return allowed === permission;
  });
}

export function assertBusinessAccess(user: SessionUser, businessId: string) {
  if (user.role === "SUPER_ADMIN") return;
  if (!user.businessId || user.businessId !== businessId) {
    throw new Error("Forbidden: cross-tenant access is not allowed.");
  }
}

export function assertRole(user: SessionUser, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden: insufficient role.");
  }
}
