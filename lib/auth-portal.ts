import type { Role } from "@prisma/client";

export const authPortals = ["admin", "support", "business", "user"] as const;
export type AuthPortal = (typeof authPortals)[number];

export const portalHomePaths: Record<AuthPortal, string> = {
  admin: "/admin",
  support: "/support",
  business: "/dashboard",
  user: "/user"
};

export const portalLabels: Record<AuthPortal, string> = {
  admin: "admin portal",
  support: "support portal",
  business: "business dashboard",
  user: "user portal"
};

export function isAuthPortal(value: string | null | undefined): value is AuthPortal {
  return value === "admin" || value === "support" || value === "business" || value === "user";
}

export function safeInternalPath(value: string | string[] | null | undefined) {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export function isAuthSurfacePath(path: string) {
  return (
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password")
  );
}

export function safeAuthNextPath(value: string | string[] | null | undefined) {
  const path = safeInternalPath(value);
  if (!path || isAuthSurfacePath(path)) return null;
  return path;
}

export function portalHomePath(portal: AuthPortal) {
  return portalHomePaths[portal];
}

export function portalForRole(role?: Role | string | null): AuthPortal {
  if (role === "SUPER_ADMIN") return "admin";
  if (role === "SUPPORT_AGENT") return "support";
  if (role === "CUSTOMER") return "user";
  return "business";
}

export function homePathForRole(role?: Role | string | null) {
  return portalHomePath(portalForRole(role));
}

export function portalFromPath(value: string | string[] | null | undefined): AuthPortal | null {
  const path = safeAuthNextPath(value);
  if (!path) return null;

  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/support" || path.startsWith("/support/")) return "support";
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "business";
  if (path === "/user" || path.startsWith("/user/")) return "user";
  if (path === "/businesses" || path.startsWith("/businesses/")) return "user";
  if (path.startsWith("/b/")) return "user";

  return null;
}

export function selectedAuthPortal(type: string | null | undefined, nextPath?: string | string[] | null): AuthPortal {
  if (isAuthPortal(type)) return type;
  return portalFromPath(nextPath) ?? "business";
}

export function authPath(page: "/login" | "/register" | "/forgot-password", portal: AuthPortal, nextPath?: string | string[] | null) {
  const params = new URLSearchParams();
  if (portal !== "business") params.set("type", portal);

  const safeNextPath = safeAuthNextPath(nextPath);
  if (safeNextPath) params.set("next", safeNextPath);

  const query = params.toString();
  return query ? `${page}?${query}` : page;
}

export function signInPathForPortal(portal: AuthPortal, nextPath?: string | string[] | null) {
  return authPath("/login", portal, safeAuthNextPath(nextPath) ?? portalHomePath(portal));
}

export function nextPathForPortal(portal: AuthPortal, nextPath?: string | string[] | null) {
  const safeNextPath = safeAuthNextPath(nextPath);
  if (!safeNextPath) return portalHomePath(portal);

  const nextPortal = portalFromPath(safeNextPath);
  if (nextPortal && nextPortal !== portal) return portalHomePath(portal);

  return safeNextPath;
}

export function safeRoleRedirectPath(value: string | string[] | null | undefined, role?: Role | string | null) {
  const fallback = homePathForRole(role);
  const path = safeAuthNextPath(value);
  if (!path) return fallback;

  const pathPortal = portalFromPath(path);
  if (pathPortal && pathPortal !== portalForRole(role)) return fallback;
  if (role === "SUPPORT_AGENT" && !(path === "/support" || path.startsWith("/support/"))) return fallback;

  return path;
}
