-- Add generic payment request tracking for QR-based UPI payments and reminders.
ALTER TABLE "Payment"
ADD COLUMN "paymentRequestUrl" TEXT,
ADD COLUMN "paymentRequestExpiresAt" TIMESTAMP(3),
ADD COLUMN "paymentReminderSentAt" TIMESTAMP(3);

CREATE INDEX "Payment_status_paymentRequestExpiresAt_idx" ON "Payment"("status", "paymentRequestExpiresAt");
