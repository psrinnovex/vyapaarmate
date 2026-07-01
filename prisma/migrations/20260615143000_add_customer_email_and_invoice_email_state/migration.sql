-- Store customer email addresses for invoice delivery and guard paid invoice emails against duplicate sends.
ALTER TABLE "Customer"
ADD COLUMN "email" TEXT;

ALTER TABLE "Order"
ADD COLUMN "invoiceEmailSentAt" TIMESTAMP(3);

CREATE INDEX "Customer_businessId_email_idx" ON "Customer"("businessId", "email");
CREATE INDEX "Order_invoiceEmailSentAt_idx" ON "Order"("invoiceEmailSentAt");
