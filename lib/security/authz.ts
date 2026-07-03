import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/session";

export class AuthorizationError extends Error {
  status: 401 | 403;

  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

const businessRoles = new Set<Role>(["OWNER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"]);
const supportRoles = new Set<Role>(["SUPER_ADMIN", "SUPPORT_AGENT"]);

export function isBusinessRole(role: Role) {
  return businessRoles.has(role);
}

export function isSupportRole(role: Role) {
  return supportRoles.has(role);
}

export function canAccessBusiness(user: Pick<SessionUser, "role" | "businessId">, businessId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (!isBusinessRole(user.role)) return false;
  return Boolean(user.businessId && user.businessId === businessId);
}

export function assertTenantAccess(user: Pick<SessionUser, "role" | "businessId">, businessId: string) {
  if (!canAccessBusiness(user, businessId)) {
    throw new AuthorizationError("Forbidden: cross-tenant access is not allowed.");
  }
}

export function assertAllowedRole(user: Pick<SessionUser, "role">, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new AuthorizationError("Forbidden: insufficient role.");
  }
}
