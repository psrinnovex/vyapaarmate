-- Track refund receipt email delivery separately from paid invoice emails.
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "refundInvoiceEmailSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_refundInvoiceEmailSentAt_idx" ON "Order"("refundInvoiceEmailSentAt");
