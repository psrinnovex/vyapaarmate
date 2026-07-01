-- Add secure customer order access, invoice references, and payment timestamps.
ALTER TABLE "Order"
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceIssuedAt" TIMESTAMP(3);

UPDATE "Order"
SET
  "publicToken" = gen_random_uuid()::text,
  "invoiceNumber" = 'INV-' || UPPER(RIGHT("businessId", 6)) || '-' || "orderNumber",
  "invoiceIssuedAt" = "createdAt";

ALTER TABLE "Order" ALTER COLUMN "publicToken" SET NOT NULL;

CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

ALTER TABLE "Payment"
ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "Payment"
SET "paidAt" = "createdAt"
WHERE "status" = 'COMPLETED';

ALTER TABLE "Subscription"
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "paymentRequestUrl" TEXT,
ADD COLUMN "paymentRequestExpiresAt" TIMESTAMP(3);

UPDATE "Subscription"
SET "invoiceNumber" = 'SUBINV-' || UPPER(RIGHT("id", 12));

CREATE UNIQUE INDEX "Subscription_invoiceNumber_key" ON "Subscription"("invoiceNumber");
