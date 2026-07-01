-- Add production coupon support and itemized subscription tax billing.

CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

ALTER TABLE "Order"
ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "couponId" TEXT;

ALTER TABLE "Subscription"
ADD COLUMN "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "taxableAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "gstRateBps" INTEGER NOT NULL DEFAULT 1800,
ADD COLUMN "gstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "subscriptionCouponId" TEXT;

UPDATE "Subscription"
SET
  "subtotalAmount" = "amount",
  "taxableAmount" = "amount"
WHERE "subtotalAmount" = 0
  AND "taxableAmount" = 0;

CREATE TABLE "BusinessCoupon" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountType" "CouponDiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "maxDiscountAmount" DECIMAL(10,2),
  "minimumOrderAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "redemptionLimit" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSubscriptionCoupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountType" "CouponDiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "maxDiscountAmount" DECIMAL(10,2),
  "minimumAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "plan" "SubscriptionPlan",
  "redemptionLimit" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformSubscriptionCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessCoupon_businessId_code_key" ON "BusinessCoupon"("businessId", "code");
CREATE INDEX "BusinessCoupon_businessId_isActive_idx" ON "BusinessCoupon"("businessId", "isActive");
CREATE INDEX "BusinessCoupon_businessId_expiresAt_idx" ON "BusinessCoupon"("businessId", "expiresAt");

CREATE UNIQUE INDEX "PlatformSubscriptionCoupon_code_key" ON "PlatformSubscriptionCoupon"("code");
CREATE INDEX "PlatformSubscriptionCoupon_isActive_expiresAt_idx" ON "PlatformSubscriptionCoupon"("isActive", "expiresAt");
CREATE INDEX "PlatformSubscriptionCoupon_plan_isActive_idx" ON "PlatformSubscriptionCoupon"("plan", "isActive");

CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");
CREATE INDEX "Subscription_subscriptionCouponId_idx" ON "Subscription"("subscriptionCouponId");

ALTER TABLE "BusinessCoupon"
ADD CONSTRAINT "BusinessCoupon_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_couponId_fkey"
FOREIGN KEY ("couponId") REFERENCES "BusinessCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_subscriptionCouponId_fkey"
FOREIGN KEY ("subscriptionCouponId") REFERENCES "PlatformSubscriptionCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessCoupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSubscriptionCoupon" ENABLE ROW LEVEL SECURITY;
