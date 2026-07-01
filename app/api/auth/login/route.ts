import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { smsVerificationEnabled } from "@/services/sms";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const bucket = await rateLimit(`login:${ip}`, 5, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many login attempts. Try again shortly." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const phoneVerificationRequired = smsVerificationEnabled();
  if ((user.role === "OWNER" || user.role === "CUSTOMER") && (!user.emailVerifiedAt || (phoneVerificationRequired && !user.phoneVerifiedAt))) {
    return NextResponse.json(
      {
        error: phoneVerificationRequired
          ? "Verify your email and phone before signing in."
          : "Verify your email before signing in.",
        verificationRequired: true,
        registrationId: user.id,
        phoneVerificationRequired,
        role: user.role
      },
      { status: 403 }
    );
  }

  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId
  });
  const cookie = sessionCookie(token);

  await writeAuditLog({
    userId: user.id,
    businessId: user.businessId,
    action: "AUTH_LOGIN",
    entity: "User",
    entityId: user.id,
    metadata: { ip }
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.businessId
    }
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
