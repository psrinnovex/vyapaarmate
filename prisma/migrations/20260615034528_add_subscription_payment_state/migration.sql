ALTER TABLE "Subscription"
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "manualVerificationReference" TEXT,
ADD COLUMN "manualVerifiedByUserId" TEXT,
ADD COLUMN "manualVerifiedAt" TIMESTAMP(3);

UPDATE "Subscription"
SET "paymentStatus" = 'COMPLETED'
WHERE "status" = 'ACTIVE' AND "paidAt" IS NOT NULL;

UPDATE "Subscription"
SET "paymentStatus" = 'FAILED'
WHERE "status" IN ('PAST_DUE', 'CANCELLED')
  AND "paidAt" IS NULL
  AND "paymentRequestExpiresAt" IS NOT NULL
  AND "paymentRequestExpiresAt" <= CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Subscription_manualVerificationReference_key"
ON "Subscription"("manualVerificationReference");

CREATE INDEX "Subscription_paymentProvider_paymentStatus_createdAt_idx"
ON "Subscription"("paymentProvider", "paymentStatus", "createdAt");
