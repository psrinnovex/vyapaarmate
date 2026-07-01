ALTER TABLE "Subscription"
ADD COLUMN "cashfreeOrderId" TEXT,
ADD COLUMN "cashfreeCfOrderId" TEXT,
ADD COLUMN "cashfreePaymentSessionId" TEXT,
ADD COLUMN "cashfreePaymentId" TEXT,
ADD COLUMN "cashfreeOrderStatus" TEXT;

ALTER TABLE "Subscription"
ALTER COLUMN "paymentProvider" SET DEFAULT 'CASHFREE';

CREATE UNIQUE INDEX "Subscription_cashfreeOrderId_key" ON "Subscription"("cashfreeOrderId");
CREATE UNIQUE INDEX "Subscription_cashfreeCfOrderId_key" ON "Subscription"("cashfreeCfOrderId");
CREATE UNIQUE INDEX "Subscription_cashfreePaymentId_key" ON "Subscription"("cashfreePaymentId");
CREATE INDEX "Subscription_status_cashfreeOrderStatus_idx" ON "Subscription"("status", "cashfreeOrderStatus");
