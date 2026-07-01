-- Add per-business Razorpay Route payout configuration and order transfer tracking.
ALTER TABLE "Business"
ADD COLUMN "razorpayLinkedAccountId" TEXT,
ADD COLUMN "razorpayRouteEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "platformFeeBps" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
ADD COLUMN "razorpayTransferId" TEXT,
ADD COLUMN "razorpayTransferStatus" TEXT,
ADD COLUMN "razorpayTransferAmount" DECIMAL(10,2),
ADD COLUMN "razorpayPlatformFee" DECIMAL(10,2),
ADD COLUMN "razorpayTransferError" TEXT,
ADD COLUMN "razorpayTransferUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Business_razorpayLinkedAccountId_key" ON "Business"("razorpayLinkedAccountId");
CREATE UNIQUE INDEX "Payment_razorpayTransferId_key" ON "Payment"("razorpayTransferId");
CREATE INDEX "Payment_status_razorpayTransferStatus_idx" ON "Payment"("status", "razorpayTransferStatus");

ALTER TABLE "Business"
ADD CONSTRAINT "Business_platformFeeBps_check" CHECK ("platformFeeBps" >= 0 AND "platformFeeBps" <= 5000);
