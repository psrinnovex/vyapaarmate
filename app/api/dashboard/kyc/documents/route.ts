import { NextResponse } from "next/server";
import type { BusinessKycDocument, BusinessKycDocumentType } from "@prisma/client";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { hasAllRequiredKycDocuments, kycDocumentRequirements, nextKycStatus } from "@/lib/kyc";
import { parseKycDocumentDataUrl } from "@/lib/kyc-document.server";
import { prisma } from "@/lib/prisma";
import { kycDocumentUploadSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

function mapDocument(document: Pick<BusinessKycDocument, "id" | "type" | "fileName" | "contentType" | "fileSize" | "uploadedAt">) {
  return {
    id: document.id,
    type: document.type,
    fileName: document.fileName,
    contentType: document.contentType,
    fileSize: document.fileSize,
    uploadedAt: document.uploadedAt.toISOString()
  };
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:kyc:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = kycDocumentUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: {
      id: true,
      subscriptionStatus: true,
      isVerified: true,
      kycStatus: true
    }
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  if (business.subscriptionStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Pay and activate your selected subscription before uploading KYC documents." }, { status: 402 });
  }
  if (business.isVerified || business.kycStatus === "APPROVED") {
    return NextResponse.json({ error: "KYC is already approved. Contact PSHR support to change approved documents." }, { status: 409 });
  }

  let documentData: ReturnType<typeof parseKycDocumentDataUrl>;
  try {
    documentData = parseKycDocumentDataUrl(parsed.data.dataUrl, parsed.data.contentType);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid KYC document." }, { status: 400 });
  }

  const uploaded = await prisma.$transaction(async (tx) => {
    const document = await tx.businessKycDocument.upsert({
      where: {
        businessId_type: {
          businessId: business.id,
          type: parsed.data.type
        }
      },
      create: {
        businessId: business.id,
        type: parsed.data.type,
        fileName: parsed.data.fileName,
        contentType: documentData.contentType,
        fileSize: documentData.fileSize,
        data: documentData.data,
        uploadedByUserId: session.id
      },
      update: {
        fileName: parsed.data.fileName,
        contentType: documentData.contentType,
        fileSize: documentData.fileSize,
        data: documentData.data,
        uploadedByUserId: session.id,
        uploadedAt: new Date()
      },
      select: {
        id: true,
        type: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        uploadedAt: true
      }
    });

    const documents = await tx.businessKycDocument.findMany({
      where: { businessId: business.id },
      select: { type: true }
    });
    const hasAllDocuments = hasAllRequiredKycDocuments(documents);
    const kycStatus = nextKycStatus({
      subscriptionStatus: business.subscriptionStatus,
      hasAllDocuments
    });

    await tx.business.update({
      where: { id: business.id },
      data: {
        kycStatus,
        kycSubmittedAt: hasAllDocuments ? new Date() : null,
        kycReviewedAt: null,
        kycReviewedByUserId: null,
        kycRejectionReason: null
      }
    });

    return { document, kycStatus };
  });

  await writeAuditLog({
    userId: session.id,
    businessId: business.id,
    action: "BUSINESS_KYC_DOCUMENT_UPLOADED",
    entity: "BusinessKycDocument",
    entityId: uploaded.document.id,
    metadata: {
      type: uploaded.document.type,
      fileName: uploaded.document.fileName,
      kycStatus: uploaded.kycStatus
    }
  });

  return NextResponse.json({
    document: mapDocument(uploaded.document),
    kycStatus: uploaded.kycStatus,
    requiredDocuments: kycDocumentRequirements.map((requirement) => requirement.type as BusinessKycDocumentType)
  });
}
