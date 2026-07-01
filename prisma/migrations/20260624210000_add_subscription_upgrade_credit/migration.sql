-- Track credit from an existing paid subscription when upgrading plans.
ALTER TABLE "Subscription"
ADD COLUMN "upgradeCreditAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "upgradedFromSubscriptionId" TEXT;

CREATE INDEX "Subscription_upgradedFromSubscriptionId_idx" ON "Subscription"("upgradedFromSubscriptionId");
