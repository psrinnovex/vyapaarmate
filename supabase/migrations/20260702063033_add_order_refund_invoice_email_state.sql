-- Track refund receipt email delivery separately from paid invoice emails.
ALTER TABLE "Order"
ADD COLUMN "refundInvoiceEmailSentAt" TIMESTAMP(3);

CREATE INDEX "Order_refundInvoiceEmailSentAt_idx" ON "Order"("refundInvoiceEmailSentAt");
