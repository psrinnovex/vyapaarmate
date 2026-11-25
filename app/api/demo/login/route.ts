import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { homePathForRole } from "@/lib/auth-portal";
import { demoAccountEmail, demoShopSlug, isDemoMode, isDemoRole, type DemoRole } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { prepareDemoWorkspace } from "@/services/demo-workspace";

export const dynamic = "force-dynamic";

const expectedRoles: Record<DemoRole, Role[]> = {
  owner: ["OWNER"],
  staff: ["KITCHEN_STAFF", "MANAGER", "DELIVERY_STAFF"],
  admin: ["SUPER_ADMIN"],
  support: ["SUPPORT_AGENT"],
  customer: ["CUSTOMER"]
};

/** The seed has no customer account, so demo mode creates a verified one on first use. */
async function ensureDemoCustomer() {
  const email = demoAccountEmail("customer");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const now = new Date();
  return prisma.user.create({
    data: {
      name: "Demo Customer",
      email,
      passwordHash: await hashPassword(randomUUID()),
      phone: "+919999900001",
      role: "CUSTOMER",
      emailVerifiedAt: now,
      phoneVerifiedAt: now
    }
  });
}

/**
 * DEMO_MODE only: one-tap sign-in to the seeded demo accounts (owner, staff, admin,
 * support) and a verified demo customer. Limited to those exact emails and roles;
 * returns 404 when demo mode is off.
 */
export async function POST(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ip = getClientIp(request);
  const bucket = await rateLimit(`demo-login:${ip}`, 20, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many demo sign-ins. Try again shortly." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  if (!isDemoRole(body?.role)) {
    return NextResponse.json({ error: "Choose a demo role." }, { status: 400 });
  }
  const role = body.role;

  const user = role === "customer" ? await ensureDemoCustomer() : await prisma.user.findUnique({ where: { email: demoAccountEmail(role) } });
  if (!user || !expectedRoles[role].includes(user.role)) {
    return NextResponse.json(
      { error: "Demo account not found. Run the database seed (npm run db:seed) and try again." },
      { status: 404 }
    );
  }

  if (user.businessId) {
    await prepareDemoWorkspace(user.businessId);
  }

  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
    sessionVersion: user.sessionVersion
  });
  const cookie = sessionCookie(token);

  await writeAuditLog({
    userId: user.id,
    businessId: user.businessId,
    action: "AUTH_DEMO_LOGIN",
    entity: "User",
    entityId: user.id,
    metadata: { ip, role }
  });

  if (role === "customer") await prepareDemoWorkspace();

  const response = NextResponse.json({ redirect: role === "customer" ? `/b/${demoShopSlug}` : homePathForRole(user.role) });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
