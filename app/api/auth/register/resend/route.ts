import { NextResponse } from "next/server";
import { registrationResendSchema } from "@/lib/validations";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import {
  createVerificationCode,
  hashVerificationCode,
  sendRegistrationCodes,
  verificationCodeLifetimeMs,
  verificationResendDelayMs
} from "@/lib/registration-verification";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const body = await request.json();
  const parsed = registrationResendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bucket = await rateLimit(`resend-registration:${ip}:${parsed.data.registrationId}`, 3, 10 * 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many resend requests. Wait a few minutes and try again." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.registrationId },
    include: { registrationVerification: true }
  });
  const verification = user?.registrationVerification;

  if (!user || (user.role !== "OWNER" && user.role !== "CUSTOMER") || !user.phone || !verification) {
    return NextResponse.json({ error: "This pending registration could not be found." }, { status: 404 });
  }

  if (verification.resendAvailableAt.getTime() > Date.now()) {
    const retryAfter = Math.ceil((verification.resendAvailableAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Wait ${retryAfter} seconds before requesting new codes.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const emailCode = createVerificationCode();
  const emailCodeHash = await hashVerificationCode(emailCode);
  const now = Date.now();

  await prisma.registrationVerification.update({
    where: { userId: user.id },
    data: {
      emailCodeHash,
      emailCodeExpiresAt: new Date(now + verificationCodeLifetimeMs),
      attempts: 0
    }
  });

  try {
    const delivery = await sendRegistrationCodes({
      email: user.email,
      phone: user.phone,
      name: user.name,
      emailCode
    });

    await prisma.registrationVerification.update({
      where: { userId: user.id },
      data: { resendAvailableAt: new Date(now + verificationResendDelayMs) }
    });

    return NextResponse.json({
      message: "New verification codes were sent.",
      phoneVerificationRequired: delivery.phoneVerificationRequired,
      devCodes:
        process.env.NODE_ENV !== "production"
          ? {
              email: delivery.emailResult.status === "placeholder" ? emailCode : undefined,
              sms:
                delivery.phoneVerificationRequired && "code" in delivery.smsResult
                  ? delivery.smsResult.code
                  : undefined
            }
          : undefined
    });
  } catch (error) {
    console.error("Registration verification resend failed", error);
    return NextResponse.json({ error: "We could not resend the codes. Try again shortly." }, { status: 503 });
  }
}
