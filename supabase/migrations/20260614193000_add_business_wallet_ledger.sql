-- Add platform-collected business wallet ledger and payout records.

CREATE TYPE "WalletEntryType" AS ENUM ('ORDER_PAYMENT_CREDIT', 'PAYOUT_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT');

CREATE TYPE "WalletEntryStatus" AS ENUM ('PENDING_PROVIDER_SETTLEMENT', 'AVAILABLE', 'SETTLED', 'CANCELLED');

CREATE TYPE "BusinessPayoutStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

CREATE TABLE "BusinessPayout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "BusinessPayoutStatus" NOT NULL DEFAULT 'PAID',
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessWalletEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paymentId" TEXT,
    "payoutId" TEXT,
    "type" "WalletEntryType" NOT NULL,
    "status" "WalletEntryStatus" NOT NULL DEFAULT 'PENDING_PROVIDER_SETTLEMENT',
    "provider" "PaymentProvider",
    "amount" DECIMAL(10,2) NOT NULL,
    "grossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platformFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "providerSettlementEligibleAt" TIMESTAMP(3),
    "providerSettledAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessWalletEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessWalletEntry_paymentId_key" ON "BusinessWalletEntry"("paymentId");

CREATE INDEX "BusinessPayout_businessId_status_createdAt_idx" ON "BusinessPayout"("businessId", "status", "createdAt");

CREATE INDEX "BusinessWalletEntry_businessId_status_createdAt_idx" ON "BusinessWalletEntry"("businessId", "status", "createdAt");

CREATE INDEX "BusinessWalletEntry_payoutId_idx" ON "BusinessWalletEntry"("payoutId");

CREATE INDEX "BusinessWalletEntry_status_providerSettlementEligibleAt_idx" ON "BusinessWalletEntry"("status", "providerSettlementEligibleAt");

ALTER TABLE "BusinessPayout"
ADD CONSTRAINT "BusinessPayout_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessWalletEntry"
ADD CONSTRAINT "BusinessWalletEntry_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessWalletEntry"
ADD CONSTRAINT "BusinessWalletEntry_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessWalletEntry"
ADD CONSTRAINT "BusinessWalletEntry_payoutId_fkey"
FOREIGN KEY ("payoutId") REFERENCES "BusinessPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
