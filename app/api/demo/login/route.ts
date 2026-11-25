import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { homePathForRole } from "@/lib/auth-portal";
import { demoAccountEmail, isDemoMode, isDemoRole, type DemoRole } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { createSessionToken, sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

const expectedRoles: Record<DemoRole, Role[]> = {
  owner: ["OWNER"],
  staff: ["KITCHEN_STAFF", "MANAGER", "DELIVERY_STAFF"],
  admin: ["SUPER_ADMIN"],
  support: ["SUPPORT_AGENT"]
};

/**
 * DEMO_MODE only: one-tap sign-in to the seeded demo accounts (owner, staff, admin,
 * support). Limited to those exact emails and roles; returns 404 when demo mode is off.
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

  const user = await prisma.user.findUnique({ where: { email: demoAccountEmail(role) } });
  if (!user || !expectedRoles[role].includes(user.role)) {
    return NextResponse.json(
      { error: "Demo account not found. Run the database seed (npm run db:seed) and try again." },
      { status: 404 }
    );
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

  const response = NextResponse.json({ redirect: homePathForRole(user.role) });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
