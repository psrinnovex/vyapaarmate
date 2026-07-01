import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { registerSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { defaultFulfillmentFlagsForBusinessType } from "@/lib/business-rules";
import { resolveBusinessServiceType } from "@/lib/business-service-types.server";
import {
  createVerificationCode,
  hashVerificationCode,
  maskEmail,
  maskPhone,
  sendRegistrationCodes,
  verificationCodeLifetimeMs,
  verificationResendDelayMs
} from "@/lib/registration-verification";

function duplicateUserResponse(target: "email" | "phone") {
  const error =
    target === "email"
      ? "An account with this email already exists. Sign in instead."
      : "An account with this phone number already exists. Use a different phone number or sign in.";

  return NextResponse.json({ error }, { status: 409 });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const bucket = await rateLimit(`register:${ip}`, 3, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many registration attempts. Try again shortly." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
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
  const slug = `${slugify(parsed.data.businessName)}-${Date.now().toString(36)}`;
  const businessServiceType = await resolveBusinessServiceType(prisma, parsed.data.businessType);
  if (!businessServiceType) {
    return NextResponse.json({ error: "Select a valid business type." }, { status: 400 });
  }

  const fulfillmentFlags = defaultFulfillmentFlagsForBusinessType(businessServiceType.name);
  const emailCode = createVerificationCode();
  const emailCodeHash = await hashVerificationCode(emailCode);
  const verificationStartedAt = Date.now();
  let createdBusinessId: string | null = null;

  try {
    const { business, user } = await prisma.$transaction(async (tx) => {
      const businessRecord = await tx.business.create({
        data: {
          name: parsed.data.businessName,
          slug,
          ownerName: parsed.data.name,
          phone,
          whatsappDisplayPhone: parsed.data.whatsappEnabled ? phone : null,
          email,
          address: "",
          city: "",
          state: "",
          businessType: businessServiceType.name,
          businessServiceTypeId: businessServiceType.id,
          subscriptionPlan: parsed.data.subscriptionPlan,
          subscriptionStatus: "PAST_DUE",
          kycStatus: "PAYMENT_PENDING",
          isVerified: false,
          isActive: false,
          isOpen: false,
          acceptsPickup: fulfillmentFlags.acceptsPickup,
          acceptsDineIn: fulfillmentFlags.acceptsDineIn,
          acceptsServiceAtLocation: fulfillmentFlags.acceptsServiceAtLocation
        }
      });

      const userRecord = await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          phone,
          passwordHash,
          role: "OWNER",
          business: { connect: { id: businessRecord.id } },
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          registrationVerification: {
            create: {
              emailCodeHash,
              emailCodeExpiresAt: new Date(verificationStartedAt + verificationCodeLifetimeMs),
              resendAvailableAt: new Date(verificationStartedAt + verificationResendDelayMs)
            }
          }
        }
      });

      return { business: businessRecord, user: userRecord };
    });
    createdBusinessId = business.id;

    const delivery = await sendRegistrationCodes({
      email: user.email,
      phone,
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

    return NextResponse.json({
      verificationRequired: true,
      registrationId: user.id,
      maskedEmail: maskEmail(user.email),
      maskedPhone: maskPhone(user.phone),
      phoneVerificationRequired: delivery.phoneVerificationRequired,
      devCodes
    });
  } catch (error) {
    if (createdBusinessId) {
      await prisma.business.delete({ where: { id: createdBusinessId } }).catch(() => undefined);
      console.error("Registration verification delivery failed", error);
      return NextResponse.json(
        { error: "We could not send the verification codes. Check the email and SMS provider setup, then try again." },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
      if (target.includes("phone")) {
        return duplicateUserResponse("phone");
      }

      if (target.includes("email")) {
        return duplicateUserResponse("email");
      }
    }

    throw error;
  }
}
