ALTER TYPE "WalletEntryStatus" ADD VALUE IF NOT EXISTS 'PROCESSING_PAYOUT';

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "cashfreePayoutBeneficiaryId" TEXT;

ALTER TABLE "BusinessPayout"
ADD COLUMN IF NOT EXISTS "autoInitiated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "provider" TEXT,
ADD COLUMN IF NOT EXISTS "providerTransferId" TEXT,
ADD COLUMN IF NOT EXISTS "providerReferenceId" TEXT,
ADD COLUMN IF NOT EXISTS "providerBeneficiaryId" TEXT,
ADD COLUMN IF NOT EXISTS "providerStatus" TEXT,
ADD COLUMN IF NOT EXISTS "providerStatusCode" TEXT,
ADD COLUMN IF NOT EXISTS "providerStatusDescription" TEXT,
ADD COLUMN IF NOT EXISTS "providerUtr" TEXT,
ADD COLUMN IF NOT EXISTS "providerAcknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "providerRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "providerCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "providerFailedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "providerUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "providerMetadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Business_cashfreePayoutBeneficiaryId_key"
ON "Business"("cashfreePayoutBeneficiaryId");

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessPayout_providerTransferId_key"
ON "BusinessPayout"("providerTransferId");

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessPayout_providerReferenceId_key"
ON "BusinessPayout"("providerReferenceId");

CREATE INDEX IF NOT EXISTS "BusinessPayout_autoInitiated_status_createdAt_idx"
ON "BusinessPayout"("autoInitiated", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "BusinessPayout_provider_providerStatus_idx"
ON "BusinessPayout"("provider", "providerStatus");

CREATE INDEX IF NOT EXISTS "BusinessPayout_status_providerRequestedAt_idx"
ON "BusinessPayout"("status", "providerRequestedAt");
