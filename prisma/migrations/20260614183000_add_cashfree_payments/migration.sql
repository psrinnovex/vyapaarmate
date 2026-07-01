-- Add Cashfree customer payment gateway support and optional Easy Split vendor configuration.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'CASHFREE';

ALTER TABLE "Business"
ADD COLUMN "cashfreeVendorId" TEXT,
ADD COLUMN "cashfreeSplitEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment"
ADD COLUMN "cashfreeOrderId" TEXT,
ADD COLUMN "cashfreeCfOrderId" TEXT,
ADD COLUMN "cashfreePaymentSessionId" TEXT,
ADD COLUMN "cashfreePaymentId" TEXT,
ADD COLUMN "cashfreeOrderStatus" TEXT;

CREATE UNIQUE INDEX "Business_cashfreeVendorId_key" ON "Business"("cashfreeVendorId");
CREATE UNIQUE INDEX "Payment_cashfreeOrderId_key" ON "Payment"("cashfreeOrderId");
CREATE UNIQUE INDEX "Payment_cashfreeCfOrderId_key" ON "Payment"("cashfreeCfOrderId");
CREATE UNIQUE INDEX "Payment_cashfreePaymentId_key" ON "Payment"("cashfreePaymentId");
CREATE INDEX "Payment_status_cashfreeOrderStatus_idx" ON "Payment"("status", "cashfreeOrderStatus");
