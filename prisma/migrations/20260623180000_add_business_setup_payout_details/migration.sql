CREATE TYPE "BusinessPayoutMethod" AS ENUM ('UPI', 'BANK_TRANSFER');

ALTER TABLE "Business"
ADD COLUMN "payoutMethod" "BusinessPayoutMethod" NOT NULL DEFAULT 'UPI',
ADD COLUMN "payoutUpiId" TEXT,
ADD COLUMN "payoutUpiName" TEXT,
ADD COLUMN "payoutAccountHolderName" TEXT,
ADD COLUMN "payoutBankName" TEXT,
ADD COLUMN "payoutBankAccountNumber" TEXT,
ADD COLUMN "payoutBankIfsc" TEXT,
ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

UPDATE "Business"
SET "setupCompletedAt" = COALESCE("setupCompletedAt", CURRENT_TIMESTAMP);

CREATE INDEX "Business_setupCompletedAt_idx" ON "Business"("setupCompletedAt");
CREATE INDEX "Business_payoutMethod_idx" ON "Business"("payoutMethod");
