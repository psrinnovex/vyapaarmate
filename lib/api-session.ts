import type { Role } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { cookieName, verifySessionToken, type SessionUser } from "@/lib/session";
import { apiForbidden, apiUnauthorized } from "@/lib/security/api-response";
import { isBusinessRole, isSupportRole } from "@/lib/security/authz";
import {
  bearerTokenFromAuthorization,
  verifyMobileAccessToken,
  type MobileAccessSession
} from "@/lib/mobile-auth";

export type BusinessSessionUser = SessionUser & {
  businessId: string;
  role: Exclude<Role, "SUPER_ADMIN" | "SUPPORT_AGENT" | "CUSTOMER">;
};

export function cookieOnlySessionToken(input: { authorization: string | null; cookieToken?: string }) {
  if (input.authorization !== null || !input.cookieToken) return null;
  return input.cookieToken;
}

async function hydrateCookieSession(cookieToken: string): Promise<SessionUser | null> {
  const session = await verifySessionToken(cookieToken);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, businessId: true, sessionVersion: true }
  });
  if (!user || user.sessionVersion !== (session.sessionVersion ?? 0)) return null;
  return user;
}

export async function getCookieSessionUser(): Promise<SessionUser | null> {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const token = cookieOnlySessionToken({
    authorization: requestHeaders.get("authorization"),
    cookieToken: cookieStore.get(cookieName)?.value
  });
  return token ? hydrateCookieSession(token) : null;
}

export async function getMobileRequestSession(): Promise<MobileAccessSession | null> {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const authorization = bearerTokenFromAuthorization(requestHeaders.get("authorization"));
  const cookieToken = cookieStore.get(cookieName)?.value;
  if (!authorization.present || !authorization.token || cookieToken) return null;
  return verifyMobileAccessToken(authorization.token);
}

export async function isMobileBearerRequest() {
  return (await headers()).has("authorization");
}

export async function rejectMobileBusinessSubscriptionRequest() {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const authorization = bearerTokenFromAuthorization(requestHeaders.get("authorization"));
  if (!authorization.present) return null;
  if (!authorization.token || cookieStore.has(cookieName)) return apiUnauthorized();

  const mobile = await verifyMobileAccessToken(authorization.token);
  if (!mobile) return apiUnauthorized();
  return NextResponse.json(
    {
      error: "Business subscription purchase is available only on the VyapaarMate website.",
      code: "MOBILE_SUBSCRIPTION_PURCHASE_NOT_AVAILABLE"
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const authorization = bearerTokenFromAuthorization(requestHeaders.get("authorization"));
  const cookieToken = cookieStore.get(cookieName)?.value;

  if (authorization.present) {
    if (!authorization.token || cookieToken) return null;
    return (await verifyMobileAccessToken(authorization.token))?.user ?? null;
  }

  return cookieToken ? hydrateCookieSession(cookieToken) : null;
}

export async function getBusinessSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  if (!session?.businessId || !isBusinessRole(session.role)) return null;

  const deletionRequest = await prisma.accountDeletionRequest.findFirst({
    where: {
      businessId: session.businessId,
      scope: "BUSINESS",
      status: { in: ["REQUESTED", "PROCESSING"] }
    },
    select: { id: true }
  });
  return deletionRequest ? null : session;
}

export async function getAdminSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session?.role === "SUPER_ADMIN" ? session : null;
}

export async function getSupportSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session && isSupportRole(session.role) ? session : null;
}

export async function requireBusinessSession(permission?: string): Promise<
  | { session: BusinessSessionUser; response?: never }
  | { session?: never; response: NextResponse }
> {
  const session = await getBusinessSession();

  if (!session?.businessId) {
    return { response: apiUnauthorized() };
  }

  if (permission && !hasPermission(session.role, permission)) {
    return { response: apiForbidden() };
  }

  return { session: session as BusinessSessionUser };
}
