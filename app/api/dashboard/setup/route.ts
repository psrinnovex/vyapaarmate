import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { filterFulfillmentFlagsForBusinessType, fulfillmentModesFromFlags } from "@/lib/business-rules";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { parseBusinessImageDataUrl, type ParsedBusinessImage } from "@/lib/business-image.server";
import { prisma } from "@/lib/prisma";
import { businessSetupSchema } from "@/lib/validations";
import { resolveBusinessServiceType } from "@/lib/business-service-types.server";

export const dynamic = "force-dynamic";

function duplicateBusinessContactResponse(target: "email" | "phone") {
  const error =
    target === "email"
      ? "Another business is already using this email address."
      : "Another business is already using this phone number.";

  return NextResponse.json({ error }, { status: 409 });
}

export async function PATCH(request: Request) {
  const auth = await requireBusinessSession("business:settings:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = businessSetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const businessServiceType = await resolveBusinessServiceType(prisma, parsed.data.businessType);
  if (!businessServiceType) {
    return NextResponse.json({ error: "Select a valid business type." }, { status: 400 });
  }

  const fulfillmentFlags = filterFulfillmentFlagsForBusinessType(businessServiceType.name, {
    acceptsPickup: parsed.data.acceptsPickup,
    acceptsDineIn: parsed.data.acceptsDineIn,
    acceptsServiceAtLocation: parsed.data.acceptsServiceAtLocation
  });

  if (!fulfillmentFlags.acceptsPickup && !fulfillmentFlags.acceptsDineIn && !fulfillmentFlags.acceptsServiceAtLocation) {
    return NextResponse.json({ error: "Enable at least one fulfillment option." }, { status: 400 });
  }

  const [existing, contactConflict] = await Promise.all([
    prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        kycStatus: true,
        whatsappDisplayPhone: true
      }
    }),
    prisma.business.findFirst({
      where: {
        id: { not: session.businessId },
        OR: [{ email: parsed.data.email }, { phone: parsed.data.phone }]
      },
      select: { email: true, phone: true }
    })
  ]);

  if (!existing) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (contactConflict) {
    return duplicateBusinessContactResponse(contactConflict.email === parsed.data.email ? "email" : "phone");
  }

  const whatsappDisplayPhone = parsed.data.whatsappEnabled
    ? parsed.data.whatsappDisplayPhone || parsed.data.phone
    : null;
  const whatsappNumberChanged = existing.whatsappDisplayPhone !== whatsappDisplayPhone;
  const payoutMethod = parsed.data.payoutMethod;
  let logoImage: ParsedBusinessImage | null | undefined;

  try {
    logoImage = typeof parsed.data.logoImageDataUrl === "string"
      ? parseBusinessImageDataUrl(parsed.data.logoImageDataUrl)
      : parsed.data.logoImageDataUrl === null
        ? null
        : undefined;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid business image" }, { status: 400 });
  }

  let business;
  try {
    business = await prisma.$transaction(async (tx) => {
      const updatedBusiness = await tx.business.update({
        where: { id: session.businessId },
        data: {
          name: parsed.data.businessName,
          ownerName: parsed.data.ownerName,
          businessType: businessServiceType.name,
          businessServiceTypeId: businessServiceType.id,
          email: parsed.data.email,
          phone: parsed.data.phone,
          address: parsed.data.address,
          city: parsed.data.city,
          state: parsed.data.state,
          businessHours: parsed.data.businessHours,
          isOpen: parsed.data.isOpen,
          minimumOrder: parsed.data.minimumOrder,
          deliveryFee: parsed.data.deliveryFee,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          serviceRadiusKm: parsed.data.serviceRadiusKm,
          acceptsPickup: fulfillmentFlags.acceptsPickup,
          acceptsDineIn: fulfillmentFlags.acceptsDineIn,
          acceptsServiceAtLocation: fulfillmentFlags.acceptsServiceAtLocation,
          allowsPayLater: parsed.data.allowsPayLater,
          ...(logoImage !== undefined ? { logoUrl: null } : {}),
          payoutMethod,
          payoutAccountHolderName: parsed.data.payoutAccountHolderName,
          payoutUpiId: payoutMethod === "UPI" ? parsed.data.payoutUpiId ?? null : null,
          payoutUpiName: payoutMethod === "UPI" ? parsed.data.payoutUpiName ?? parsed.data.payoutAccountHolderName : null,
          payoutBankName: payoutMethod === "BANK_TRANSFER" ? parsed.data.payoutBankName ?? null : null,
          payoutBankAccountNumber: payoutMethod === "BANK_TRANSFER" ? parsed.data.payoutBankAccountNumber ?? null : null,
          payoutBankIfsc: payoutMethod === "BANK_TRANSFER" ? parsed.data.payoutBankIfsc ?? null : null,
          setupCompletedAt: new Date(),
          ...(existing.subscriptionStatus === "ACTIVE" && existing.kycStatus === "PAYMENT_PENDING"
            ? { kycStatus: "DOCUMENTS_PENDING" }
            : {}),
          whatsappDisplayPhone,
          ...(!parsed.data.whatsappEnabled
            ? {
                whatsappPhoneNumberId: null,
                whatsappWabaId: null,
                whatsappAccessTokenEnc: null,
                whatsappConnected: false,
                whatsappLiveEnabled: false,
                whatsappApprovedAt: null
              }
            : whatsappNumberChanged
              ? {
                  whatsappPhoneNumberId: null,
                  whatsappWabaId: null,
                  whatsappAccessTokenEnc: null,
                  whatsappConnected: false,
                  whatsappLiveEnabled: false,
                  whatsappApprovedAt: null
                }
              : {})
        }
      });

      if (logoImage === null) {
        await tx.businessImage.deleteMany({ where: { businessId: session.businessId } });
      } else if (logoImage) {
        await tx.businessImage.upsert({
          where: { businessId: session.businessId },
          create: { businessId: session.businessId, ...logoImage },
          update: logoImage
        });
      }

      return updatedBusiness;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
      if (target.includes("phone")) return duplicateBusinessContactResponse("phone");
      if (target.includes("email")) return duplicateBusinessContactResponse("email");
    }

    throw error;
  }

  const fulfillmentModes = fulfillmentModesFromFlags({
    businessType: business.businessType,
    acceptsPickup: business.acceptsPickup,
    acceptsDineIn: business.acceptsDineIn,
    acceptsServiceAtLocation: business.acceptsServiceAtLocation
  });

  await writeAuditLog({
    userId: session.id,
    businessId: business.id,
    action: "BUSINESS_SETUP_COMPLETED",
    entity: "Business",
    entityId: business.id,
    metadata: {
      businessType: business.businessType,
      payoutMethod: business.payoutMethod,
      logoImageChanged: parsed.data.logoImageDataUrl !== undefined,
      locationSet: business.latitude !== null && business.longitude !== null,
      settlementWindow: "Daily 9 AM IST payout batch, within 24 hours after online payment clears",
      fulfillmentModes
    }
  });

  return NextResponse.json({
    business: {
      id: business.id,
      name: business.name,
      setupCompletedAt: business.setupCompletedAt?.toISOString() ?? null,
      subscriptionStatus: business.subscriptionStatus,
      fulfillmentModes
    },
    redirectPath: business.subscriptionStatus === "ACTIVE" ? "/dashboard/setup" : `/dashboard/billing/checkout?plan=${business.subscriptionPlan}`
  });
}
