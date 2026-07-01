-- Existing Premium tenants continue on Pro. Pending Premium QR requests are
-- expired so checkout creates a new Pro request at the current Pro price.
UPDATE "Business"
SET "subscriptionPlan" = 'PRO'
WHERE "subscriptionPlan" = 'PREMIUM';

UPDATE "Subscription"
SET
  "plan" = 'PRO',
  "paymentRequestExpiresAt" = CASE
    WHEN "status" = 'PAST_DUE' AND "paidAt" IS NULL THEN CURRENT_TIMESTAMP
    ELSE "paymentRequestExpiresAt"
  END
WHERE "plan" = 'PREMIUM';

ALTER TABLE "Business" ALTER COLUMN "subscriptionPlan" DROP DEFAULT;

CREATE TYPE "SubscriptionPlan_new" AS ENUM ('STARTER', 'PRO');

ALTER TABLE "Business"
ALTER COLUMN "subscriptionPlan" TYPE "SubscriptionPlan_new"
USING ("subscriptionPlan"::text::"SubscriptionPlan_new");

ALTER TABLE "Subscription"
ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
USING ("plan"::text::"SubscriptionPlan_new");

DROP TYPE "SubscriptionPlan";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";

ALTER TABLE "Business" ALTER COLUMN "subscriptionPlan" SET DEFAULT 'STARTER';
