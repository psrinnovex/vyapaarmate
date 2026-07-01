import type { BusinessKycDocumentType, BusinessKycStatus, SubscriptionStatus } from "@prisma/client";

export const kycDocumentRequirements = [
  {
    type: "BUSINESS_REGISTRATION",
    label: "Business registration",
    description: "Trade license, GST certificate, FSSAI license, shop act certificate, or other registration proof."
  },
  {
    type: "OWNER_ID",
    label: "Owner identity",
    description: "PAN, Aadhaar, passport, or other government identity proof for the owner."
  },
  {
    type: "ADDRESS_PROOF",
    label: "Business address proof",
    description: "Utility bill, rent agreement, tax receipt, or address certificate for the business location."
  },
  {
    type: "BANK_PROOF",
    label: "Bank proof",
    description: "Cancelled cheque, passbook, or bank letter for payout verification."
  }
] as const satisfies ReadonlyArray<{
  type: BusinessKycDocumentType;
  label: string;
  description: string;
}>;

export const kycDocumentTypes = kycDocumentRequirements.map((requirement) => requirement.type) as [
  BusinessKycDocumentType,
  ...BusinessKycDocumentType[]
];

export const kycAllowedContentTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const kycMaxDocumentBytes = 5 * 1024 * 1024;

export function kycDocumentLabel(type: BusinessKycDocumentType | string) {
  return kycDocumentRequirements.find((requirement) => requirement.type === type)?.label ?? type.replaceAll("_", " ");
}

export function hasAllRequiredKycDocuments(documents: Array<{ type: BusinessKycDocumentType | string }>) {
  const uploadedTypes = new Set(documents.map((document) => document.type));
  return kycDocumentRequirements.every((requirement) => uploadedTypes.has(requirement.type));
}

export function nextKycStatus(input: {
  subscriptionStatus: SubscriptionStatus | string;
  isVerified?: boolean;
  hasAllDocuments: boolean;
}): BusinessKycStatus {
  if (input.isVerified) return "APPROVED";
  if (input.subscriptionStatus !== "ACTIVE") return "PAYMENT_PENDING";
  return input.hasAllDocuments ? "UNDER_REVIEW" : "DOCUMENTS_PENDING";
}

export function formatKycStatus(status: BusinessKycStatus | string) {
  switch (status) {
    case "PAYMENT_PENDING":
      return "Payment Pending";
    case "DOCUMENTS_PENDING":
      return "Docs Pending";
    case "UNDER_REVIEW":
      return "Under Review";
    case "APPROVED":
      return "Verified";
    case "REJECTED":
      return "Rejected";
    default:
      return status.replaceAll("_", " ");
  }
}
