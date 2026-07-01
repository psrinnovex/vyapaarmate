import type { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { cookieName, verifySessionToken, type SessionUser } from "@/lib/session";

export type BusinessSessionUser = SessionUser & {
  businessId: string;
  role: Exclude<Role, "SUPER_ADMIN" | "SUPPORT_AGENT" | "CUSTOMER">;
};

const businessRoles = new Set<Role>(["OWNER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"]);
const supportRoles = new Set<Role>(["SUPER_ADMIN", "SUPPORT_AGENT"]);

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, businessId: true }
  });

  return user;
}

export async function getBusinessSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session?.businessId && businessRoles.has(session.role) ? session : null;
}

export async function getAdminSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session?.role === "SUPER_ADMIN" ? session : null;
}

export async function getSupportSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session && supportRoles.has(session.role) ? session : null;
}

export async function requireBusinessSession(permission?: string): Promise<
  | { session: BusinessSessionUser; response?: never }
  | { session?: never; response: NextResponse }
> {
  const session = await getBusinessSession();

  if (!session?.businessId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (permission && !hasPermission(session.role, permission)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session: session as BusinessSessionUser };
}
