-- Persist subscription checkout payment-link state for Razorpay activation webhooks.
ALTER TABLE "Subscription"
ADD COLUMN "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
ADD COLUMN "razorpayPaymentLinkId" TEXT,
ADD COLUMN "razorpayPaymentId" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE INDEX "Subscription_razorpayPaymentLinkId_idx" ON "Subscription"("razorpayPaymentLinkId");
