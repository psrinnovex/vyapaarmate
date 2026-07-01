import type { SessionUser } from "./session";
import { homePathForRole, safeAuthNextPath, safeRoleRedirectPath } from "./auth-portal";

export function sessionHomePath(session: Pick<SessionUser, "role">) {
  return homePathForRole(session.role);
}

export function safeInternalPath(value: string | string[] | null | undefined) {
  return safeAuthNextPath(value);
}

export function sessionRedirectPath(session: Pick<SessionUser, "role">, requestedPath?: string | string[] | null) {
  return safeRoleRedirectPath(requestedPath, session.role);
}
