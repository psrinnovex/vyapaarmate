CREATE TYPE "BusinessKycStatus" AS ENUM ('PAYMENT_PENDING', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

CREATE TYPE "BusinessKycDocumentType" AS ENUM ('BUSINESS_REGISTRATION', 'OWNER_ID', 'ADDRESS_PROOF', 'BANK_PROOF');

ALTER TABLE "Business"
ADD COLUMN "kycStatus" "BusinessKycStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
ADD COLUMN "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN "kycReviewedByUserId" TEXT,
ADD COLUMN "kycRejectionReason" TEXT;

UPDATE "Business"
SET "kycStatus" = CASE
  WHEN "isVerified" = TRUE THEN 'APPROVED'::"BusinessKycStatus"
  WHEN "subscriptionStatus" = 'ACTIVE'::"SubscriptionStatus" THEN 'DOCUMENTS_PENDING'::"BusinessKycStatus"
  ELSE 'PAYMENT_PENDING'::"BusinessKycStatus"
END;

CREATE TABLE "BusinessKycDocument" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type" "BusinessKycDocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "uploadedByUserId" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessKycDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessKycDocument_businessId_type_key" ON "BusinessKycDocument"("businessId", "type");
CREATE INDEX "BusinessKycDocument_businessId_uploadedAt_idx" ON "BusinessKycDocument"("businessId", "uploadedAt");
CREATE INDEX "BusinessKycDocument_type_idx" ON "BusinessKycDocument"("type");
CREATE INDEX "Business_kycStatus_idx" ON "Business"("kycStatus");
CREATE INDEX "Business_isActive_isVerified_kycStatus_idx" ON "Business"("isActive", "isVerified", "kycStatus");

ALTER TABLE "BusinessKycDocument"
ADD CONSTRAINT "BusinessKycDocument_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
