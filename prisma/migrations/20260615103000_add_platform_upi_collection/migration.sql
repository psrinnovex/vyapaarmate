CREATE TABLE "PlatformPaymentSettings" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "directUpiEnabled" BOOLEAN NOT NULL DEFAULT false,
  "upiId" TEXT,
  "upiName" TEXT NOT NULL DEFAULT 'PSHR Innovex Pvt Ltd',
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformPaymentSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment"
ADD COLUMN "manualVerificationReference" TEXT,
ADD COLUMN "manualVerifiedByUserId" TEXT,
ADD COLUMN "manualVerifiedAt" TIMESTAMP(3);

CREATE INDEX "Payment_provider_status_createdAt_idx"
ON "Payment"("provider", "status", "createdAt");
