import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  createVerificationCode,
  hashVerificationCode,
  maskEmail,
  maskPhone,
  sendRegistrationCodes,
  verificationCodeLifetimeMs,
  verificationResendDelayMs
} from "@/lib/registration-verification";
import { userRegisterSchema } from "@/lib/validations";

function duplicateUserResponse(target: "email" | "phone") {
  const error =
    target === "email"
      ? "An account with this email already exists. Sign in instead."
      : "An account with this phone number already exists. Use a different phone number or sign in.";

  return NextResponse.json({ error }, { status: 409 });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const bucket = await rateLimit(`user-register:${ip}`, 3, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many registration attempts. Try again shortly." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = userRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone;
  const [existingUser, existingBusiness] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true }
    }),
    prisma.business.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true }
    })
  ]);

  if (existingUser) {
    return duplicateUserResponse(existingUser.email === email ? "email" : "phone");
  }
  if (existingBusiness) {
    return duplicateUserResponse(existingBusiness.email === email ? "email" : "phone");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const emailCode = createVerificationCode();
  const emailCodeHash = await hashVerificationCode(emailCode);
  const verificationStartedAt = Date.now();
  let createdUserId: string | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        phone,
        passwordHash,
        role: Role.CUSTOMER,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        registrationVerification: {
          create: {
            emailCodeHash,
            emailCodeExpiresAt: new Date(verificationStartedAt + verificationCodeLifetimeMs),
            resendAvailableAt: new Date(verificationStartedAt + verificationResendDelayMs)
          }
        }
      },
      select: { id: true, name: true, email: true, phone: true }
    });
    createdUserId = user.id;

    const delivery = await sendRegistrationCodes({
      email: user.email,
      phone: user.phone ?? phone,
      name: user.name,
      emailCode
    });

    const devCodes =
      process.env.NODE_ENV !== "production"
        ? {
            email: delivery.emailResult.status === "placeholder" ? emailCode : undefined,
            sms: "code" in delivery.smsResult ? delivery.smsResult.code : undefined
          }
        : undefined;

    return NextResponse.json(
      {
        verificationRequired: true,
        registrationId: user.id,
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone),
        phoneVerificationRequired: delivery.phoneVerificationRequired,
        devCodes
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => undefined);
      console.error("User verification delivery failed", error);
      return NextResponse.json(
        { error: "We could not send the verification codes. Check the email and SMS provider setup, then try again." },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
      if (target.includes("phone")) return duplicateUserResponse("phone");
      if (target.includes("email")) return duplicateUserResponse("email");
    }

    throw error;
  }
}
