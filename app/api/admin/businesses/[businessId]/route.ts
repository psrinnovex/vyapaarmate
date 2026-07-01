import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { filterFulfillmentFlagsForBusinessType, fulfillmentModesFromFlags } from "@/lib/business-rules";
import { formatKycStatus, hasAllRequiredKycDocuments, kycDocumentRequirements, nextKycStatus } from "@/lib/kyc";
import { prisma } from "@/lib/prisma";
import { adminBusinessPatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

function mapBusiness(business: {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  kycStatus: string;
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  kycRejectionReason: string | null;
  businessType: string;
  isActive: boolean;
  isOpen: boolean;
  isVerified: boolean;
  deliveryFee: unknown;
  latitude: unknown;
  longitude: unknown;
  serviceRadiusKm: unknown;
  acceptsPickup: boolean;
  acceptsDineIn: boolean;
  acceptsServiceAtLocation: boolean;
  payoutMethod: "UPI" | "BANK_TRANSFER";
  payoutUpiId: string | null;
  payoutUpiName: string | null;
  payoutAccountHolderName: string | null;
  payoutBankName: string | null;
  payoutBankAccountNumber: string | null;
  payoutBankIfsc: string | null;
  setupCompletedAt: Date | null;
  whatsappDisplayPhone: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappWabaId: string | null;
  whatsappAccessTokenEnc: string | null;
  whatsappConnected: boolean;
  whatsappLiveEnabled: boolean;
  whatsappApprovedAt: Date | null;
  cashfreeVendorId: string | null;
  cashfreeSplitEnabled: boolean;
  platformFeeBps: number;
  createdAt: Date;
  _count: { orders: number; customers: number };
  kycDocuments?: Array<{
    id: string;
    type: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    uploadedAt: Date;
  }>;
}) {
  const kycStatus = business.isVerified
    ? "APPROVED"
    : business.subscriptionStatus !== "ACTIVE"
      ? "PAYMENT_PENDING"
      : business.kycStatus === "REJECTED"
        ? "REJECTED"
      : hasAllRequiredKycDocuments(business.kycDocuments ?? [])
        ? "UNDER_REVIEW"
        : business.kycStatus;
  const status = !business.isVerified
    ? business.subscriptionStatus !== "ACTIVE"
      ? "Payment Pending"
      : kycStatus === "DOCUMENTS_PENDING"
        ? "Docs Pending"
        : kycStatus === "REJECTED"
          ? "KYC Rejected"
          : "Pending Approval"
    : !business.isActive
      ? "Suspended"
      : business.subscriptionStatus === "CANCELLED"
        ? "Inactive"
        : business.subscriptionStatus === "TRIAL"
          ? "Trial"
          : business.subscriptionStatus === "PAST_DUE"
            ? "PENDING"
            : "Active";

  return {
    id: business.id,
    name: business.name,
    phone: business.phone,
    address: business.address,
    city: business.city,
    state: business.state,
    plan: business.subscriptionPlan[0] + business.subscriptionPlan.slice(1).toLowerCase(),
    subscriptionStatus: business.subscriptionStatus,
    status,
    businessType: business.businessType,
    isOpen: business.isOpen,
    serviceVisitFee: Number(business.deliveryFee),
    latitude: business.latitude === null ? null : Number(business.latitude),
    longitude: business.longitude === null ? null : Number(business.longitude),
    serviceRadiusKm: Number(business.serviceRadiusKm),
    fulfillmentModes: fulfillmentModesFromFlags({
      businessType: business.businessType,
      acceptsPickup: business.acceptsPickup,
      acceptsDineIn: business.acceptsDineIn,
      acceptsServiceAtLocation: business.acceptsServiceAtLocation
    }),
    acceptsPickup: business.acceptsPickup,
    acceptsDineIn: business.acceptsDineIn,
    acceptsServiceAtLocation: business.acceptsServiceAtLocation,
    payoutMethod: business.payoutMethod,
    payoutUpiId: business.payoutUpiId,
    payoutUpiName: business.payoutUpiName,
    payoutAccountHolderName: business.payoutAccountHolderName,
    payoutBankName: business.payoutBankName,
    payoutBankAccountNumber: business.payoutBankAccountNumber,
    payoutBankIfsc: business.payoutBankIfsc,
    setupCompletedAt: business.setupCompletedAt?.toISOString() ?? null,
    whatsappDisplayPhone: business.whatsappDisplayPhone,
    whatsappPhoneNumberId: business.whatsappPhoneNumberId,
    whatsappWabaId: business.whatsappWabaId,
    whatsappConnected: business.whatsappConnected,
    whatsappLiveEnabled: business.whatsappLiveEnabled,
    whatsappApprovedAt: business.whatsappApprovedAt?.toISOString() ?? null,
    whatsappAccessTokenConfigured: Boolean(business.whatsappAccessTokenEnc),
    cashfreeVendorId: business.cashfreeVendorId,
    cashfreeSplitEnabled: business.cashfreeSplitEnabled,
    platformFeeBps: business.platformFeeBps,
    walletGrossCredited: 0,
    walletPlatformFees: 0,
    walletPendingProviderSettlement: 0,
    walletAvailableForPayout: 0,
    walletSettledCredits: 0,
    walletPaidOut: 0,
    revenue: 0,
    orders: business._count.orders,
    customers: business._count.customers,
    kyc: formatKycStatus(kycStatus),
    kycStatus,
    kycRequiredDocumentCount: kycDocumentRequirements.length,
    kycUploadedDocumentCount: business.kycDocuments?.length ?? 0,
    kycMissingDocumentCount: Math.max(0, kycDocumentRequirements.length - (business.kycDocuments?.length ?? 0)),
    kycReadyForApproval: business.subscriptionStatus === "ACTIVE" && !business.isVerified && hasAllRequiredKycDocuments(business.kycDocuments ?? []),
    kycSubmittedAt: business.kycSubmittedAt?.toISOString() ?? null,
    kycReviewedAt: business.kycReviewedAt?.toISOString() ?? null,
    kycRejectionReason: business.kycRejectionReason,
    createdAt: business.createdAt.toISOString()
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = adminBusinessPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { businessId } = await context.params;
  const existing = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      businessType: true,
      isActive: true,
      isVerified: true,
      whatsappConnected: true,
      whatsappDisplayPhone: true,
      whatsappPhoneNumberId: true,
      whatsappWabaId: true,
      whatsappAccessTokenEnc: true,
      cashfreeVendorId: true,
      cashfreeSplitEnabled: true,
      platformFeeBps: true,
      subscriptionStatus: true,
      kycStatus: true,
      kycDocuments: { select: { type: true } }
    }
  });
  if (!existing) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  let updateData: Prisma.BusinessUpdateInput;
  if (parsed.data.action === "serviceArea") {
    const fulfillmentFlags = filterFulfillmentFlagsForBusinessType(existing.businessType, {
      acceptsPickup: parsed.data.acceptsPickup,
      acceptsDineIn: parsed.data.acceptsDineIn,
      acceptsServiceAtLocation: parsed.data.acceptsServiceAtLocation
    });

    if (!fulfillmentFlags.acceptsPickup && !fulfillmentFlags.acceptsDineIn && !fulfillmentFlags.acceptsServiceAtLocation) {
      return NextResponse.json({ error: "Enable at least one fulfillment option." }, { status: 400 });
    }

    updateData = {
      deliveryFee: parsed.data.serviceVisitFee,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      serviceRadiusKm: parsed.data.serviceRadiusKm,
      acceptsPickup: fulfillmentFlags.acceptsPickup,
      acceptsDineIn: fulfillmentFlags.acceptsDineIn,
      acceptsServiceAtLocation: fulfillmentFlags.acceptsServiceAtLocation
    };
  } else if (parsed.data.action === "approve") {
    if (existing.subscriptionStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Verify the selected subscription payment before approving KYC." }, { status: 400 });
    }
    if (!hasAllRequiredKycDocuments(existing.kycDocuments)) {
      return NextResponse.json({ error: "All required KYC documents must be uploaded before approval." }, { status: 400 });
    }

    updateData = {
      isActive: true,
      isVerified: true,
      isOpen: true,
      kycStatus: "APPROVED",
      kycSubmittedAt: new Date(),
      kycReviewedAt: new Date(),
      kycReviewedByUserId: session.id,
      kycRejectionReason: null
    };
  } else if (parsed.data.action === "reject") {
    if (existing.subscriptionStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Only businesses with an active subscription can be rejected for KYC review." }, { status: 400 });
    }
    if (!hasAllRequiredKycDocuments(existing.kycDocuments)) {
      return NextResponse.json({ error: "All required KYC documents must be uploaded before rejecting KYC." }, { status: 400 });
    }

    updateData = {
      isActive: false,
      isVerified: false,
      isOpen: false,
      kycStatus: "REJECTED",
      kycSubmittedAt: new Date(),
      kycReviewedAt: new Date(),
      kycReviewedByUserId: session.id,
      kycRejectionReason: "Rejected by PSHR admin review. Upload corrected KYC documents for another review.",
      whatsappLiveEnabled: false,
      whatsappApprovedAt: null,
      cashfreeSplitEnabled: false
    };
  } else if (parsed.data.action === "unapprove") {
    updateData = {
      isActive: false,
      isVerified: false,
      isOpen: false,
      kycStatus: nextKycStatus({
        subscriptionStatus: existing.subscriptionStatus,
        hasAllDocuments: hasAllRequiredKycDocuments(existing.kycDocuments)
      }),
      kycReviewedAt: null,
      kycReviewedByUserId: null,
      whatsappLiveEnabled: false,
      whatsappApprovedAt: null,
      cashfreeSplitEnabled: false
    };
  } else if (parsed.data.action === "suspend") {
    updateData = { isActive: false, whatsappLiveEnabled: false, whatsappApprovedAt: null, cashfreeSplitEnabled: false };
  } else if (parsed.data.action === "open") {
    updateData = { isOpen: true };
  } else if (parsed.data.action === "whatsappSetup") {
    let nextTokenEnc: string | null;
    try {
      nextTokenEnc = parsed.data.whatsappAccessToken
        ? encryptSecret(parsed.data.whatsappAccessToken)
        : existing.whatsappAccessTokenEnc ?? null;
    } catch {
      return NextResponse.json({ error: "ENCRYPTION_KEY must be configured before saving a WhatsApp access token." }, { status: 500 });
    }

    const whatsappDisplayPhone = parsed.data.whatsappDisplayPhone || existing.whatsappDisplayPhone;
    const whatsappConnected = Boolean(whatsappDisplayPhone && parsed.data.whatsappPhoneNumberId && nextTokenEnc);
    const setupChanged = Boolean(parsed.data.whatsappAccessToken) ||
      existing.whatsappDisplayPhone !== whatsappDisplayPhone ||
      existing.whatsappPhoneNumberId !== (parsed.data.whatsappPhoneNumberId ?? null) ||
      existing.whatsappWabaId !== (parsed.data.whatsappWabaId ?? null);

    updateData = {
      whatsappDisplayPhone,
      whatsappPhoneNumberId: parsed.data.whatsappPhoneNumberId ?? null,
      whatsappWabaId: parsed.data.whatsappWabaId ?? null,
      whatsappAccessTokenEnc: nextTokenEnc,
      whatsappConnected,
      whatsappLiveEnabled: setupChanged ? false : undefined,
      whatsappApprovedAt: setupChanged ? null : undefined
    };
  } else if (parsed.data.action === "approveWhatsapp") {
    if (!existing.isActive || !existing.isVerified) {
      return NextResponse.json({ error: "Approve the business before approving WhatsApp live sends." }, { status: 400 });
    }
    if (!existing.whatsappConnected || !existing.whatsappPhoneNumberId || !existing.whatsappAccessTokenEnc) {
      return NextResponse.json({ error: "WhatsApp Cloud API details are incomplete for this business." }, { status: 400 });
    }

    updateData = { whatsappLiveEnabled: true, whatsappApprovedAt: new Date() };
  } else if (parsed.data.action === "disableWhatsapp") {
    updateData = { whatsappLiveEnabled: false, whatsappApprovedAt: null };
  } else if (parsed.data.action === "payoutSetup") {
    updateData = {
      razorpayLinkedAccountId: null,
      razorpayRouteEnabled: false,
      cashfreeVendorId: null,
      cashfreeSplitEnabled: false,
      platformFeeBps: parsed.data.platformFeeBps
    };
  } else {
    updateData = { isOpen: false };
  }

  const business = await prisma.business.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      _count: { select: { orders: true, customers: true } },
      kycDocuments: {
        select: {
          id: true,
          type: true,
          fileName: true,
          contentType: true,
          fileSize: true,
          uploadedAt: true
        }
      }
    }
  });

  await writeAuditLog({
    userId: session.id,
    businessId: business.id,
    action:
      parsed.data.action === "serviceArea"
        ? "BUSINESS_SERVICE_AREA_UPDATED"
        : parsed.data.action === "approve"
        ? "BUSINESS_APPROVED"
        : parsed.data.action === "reject"
          ? "BUSINESS_KYC_REJECTED"
        : parsed.data.action === "unapprove"
          ? "BUSINESS_UNAPPROVED"
        : parsed.data.action === "suspend"
          ? "BUSINESS_SUSPENDED"
        : parsed.data.action === "open"
            ? "BUSINESS_OPENED"
          : parsed.data.action === "whatsappSetup"
            ? "BUSINESS_WHATSAPP_SETUP_UPDATED"
          : parsed.data.action === "approveWhatsapp"
            ? "BUSINESS_WHATSAPP_APPROVED"
          : parsed.data.action === "disableWhatsapp"
            ? "BUSINESS_WHATSAPP_DISABLED"
          : parsed.data.action === "payoutSetup"
            ? "BUSINESS_WALLET_PAYOUT_SETUP_UPDATED"
            : "BUSINESS_CLOSED",
    entity: "Business",
    entityId: business.id,
    metadata:
      parsed.data.action === "serviceArea"
        ? {
            serviceRadiusKm: Number(business.serviceRadiusKm),
            latitude: business.latitude === null ? null : Number(business.latitude),
            longitude: business.longitude === null ? null : Number(business.longitude),
            fulfillmentModes: fulfillmentModesFromFlags({
              businessType: business.businessType,
              acceptsPickup: business.acceptsPickup,
              acceptsDineIn: business.acceptsDineIn,
              acceptsServiceAtLocation: business.acceptsServiceAtLocation
            })
          }
        : parsed.data.action === "payoutSetup"
          ? {
              platformFeeBps: business.platformFeeBps
            }
          : undefined
  });

  return NextResponse.json({ business: mapBusiness(business) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { businessId } = await context.params;
  if (session.businessId === businessId) {
    return NextResponse.json({ error: "You cannot delete the business attached to your current session." }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      _count: {
        select: {
          users: true,
          categories: true,
          menuItems: true,
          customers: true,
          orders: true,
          payments: true,
          whatsappMessages: true,
          subscriptions: true,
          kycDocuments: true,
          auditLogs: true
        }
      }
    }
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  await prisma.business.delete({ where: { id: business.id } });
  await writeAuditLog({
    userId: session.id,
    businessId: null,
    action: "BUSINESS_DELETED",
    entity: "Business",
    entityId: business.id,
    metadata: {
      name: business.name,
      slug: business.slug,
      counts: business._count
    }
  });

  return NextResponse.json({ deletedId: business.id, counts: business._count });
}
