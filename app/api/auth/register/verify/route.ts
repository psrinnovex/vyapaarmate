import { NextResponse } from "next/server";
import { registrationVerificationSchema } from "@/lib/validations";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { maximumVerificationAttempts, verifyEmailCode } from "@/lib/registration-verification";
import { smsVerificationEnabled, verifyOtp } from "@/services/sms";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const body = await request.json();
  const parsed = registrationVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bucket = await rateLimit(`verify-registration:${ip}:${parsed.data.registrationId}`, 8, 10 * 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many verification attempts. Request new codes and try again." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.registrationId },
    include: { registrationVerification: true, business: true }
  });

  if (!user || (user.role !== "OWNER" && user.role !== "CUSTOMER") || !user.phone) {
    return NextResponse.json({ error: "This registration could not be found." }, { status: 404 });
  }

  const phoneVerificationRequired = smsVerificationEnabled();
  if (user.emailVerifiedAt && (!phoneVerificationRequired || user.phoneVerifiedAt)) {
    return NextResponse.json({ error: "This account is already verified. Sign in to continue." }, { status: 409 });
  }

  const verification = user.registrationVerification;
  if (!verification) {
    return NextResponse.json({ error: "Request new verification codes to continue." }, { status: 409 });
  }

  if (verification.attempts >= maximumVerificationAttempts) {
    return NextResponse.json({ error: "Too many incorrect codes. Request new codes to continue." }, { status: 429 });
  }

  if (verification.emailCodeExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "The verification codes expired. Request new codes." }, { status: 410 });
  }

  const emailApproved = await verifyEmailCode(parsed.data.emailCode, verification.emailCodeHash);
  if (!emailApproved) {
    await prisma.registrationVerification.update({
      where: { userId: user.id },
      data: { attempts: { increment: 1 } }
    });
    return NextResponse.json({ error: "The email code is incorrect." }, { status: 400 });
  }

  let phoneApproved = false;
  if (phoneVerificationRequired) {
    if (!parsed.data.smsCode) {
      return NextResponse.json({ error: "Enter the SMS verification code." }, { status: 400 });
    }

    try {
      phoneApproved = (await verifyOtp({ phone: user.phone, code: parsed.data.smsCode })).approved;
    } catch (error) {
      console.error("SMS verification check failed", error);
      return NextResponse.json({ error: "The SMS provider is temporarily unavailable. Try again shortly." }, { status: 503 });
    }

    if (!phoneApproved) {
      await prisma.registrationVerification.update({
        where: { userId: user.id },
        data: { attempts: { increment: 1 } }
      });
      return NextResponse.json({ error: "The SMS code is incorrect." }, { status: 400 });
    }
  }

  const verifiedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: verifiedAt,
        phoneVerifiedAt: phoneVerificationRequired ? verifiedAt : user.phoneVerifiedAt
      }
    }),
    prisma.registrationVerification.deleteMany({ where: { userId: user.id } })
  ]);

  await writeAuditLog({
    userId: user.id,
    businessId: user.businessId,
    action: user.role === "CUSTOMER" ? "AUTH_USER_REGISTERED" : "BUSINESS_REGISTERED",
    entity: user.role === "CUSTOMER" ? "User" : "Business",
    entityId: user.role === "CUSTOMER" ? user.id : user.businessId,
    metadata: { ip, emailVerified: true, phoneVerified: phoneVerificationRequired }
  });

  const token = await createSessionToken(user);
  const cookie = sessionCookie(token);
  const response = NextResponse.json({
    role: user.role,
    businessSlug: user.business?.slug,
    redirectPath: user.role === "CUSTOMER" ? "/user" : "/dashboard/setup"
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
