-- Add itemized GST fields to customer orders.

ALTER TABLE "Order"
ADD COLUMN "taxableAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "gstRateBps" INTEGER NOT NULL DEFAULT 1800,
ADD COLUMN "gstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Existing orders were created before order-level GST was itemized.
UPDATE "Order"
SET
  "taxableAmount" = "totalAmount",
  "gstRateBps" = 0,
  "gstAmount" = 0;
