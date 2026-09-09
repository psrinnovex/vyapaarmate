CREATE TYPE "DataOrigin" AS ENUM (
  'LIVE',
  'HISTORICAL_IMPORT',
  'MANUAL',
  'EXTERNAL_BENCHMARK',
  'DEMO',
  'SEED',
  'TEST'
);

ALTER TABLE "MenuCategory"
  ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MenuItem"
  ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Customer"
  ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MenuCategory"
  ADD CONSTRAINT "MenuCategory_non_production_training_ineligible"
  CHECK (
    "dataOrigin" IN ('LIVE', 'HISTORICAL_IMPORT', 'MANUAL')
    OR "trainingEligible" = false
  );

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_non_production_training_ineligible"
  CHECK (
    "dataOrigin" IN ('LIVE', 'HISTORICAL_IMPORT', 'MANUAL')
    OR "trainingEligible" = false
  );

ALTER TABLE "Order"
  ADD COLUMN "scheduledFor" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "noShowAt" TIMESTAMP(3),
  ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Payment"
  ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT true;

-- Preserve the provenance of deterministic local/demo fixtures on existing databases.
UPDATE "MenuCategory"
SET "dataOrigin" = 'SEED', "trainingEligible" = false
WHERE "id" IN ('cat_breakfast', 'cat_meals', 'cat_bowls', 'cat_cakes');

UPDATE "MenuItem"
SET "dataOrigin" = 'SEED', "trainingEligible" = false
WHERE "id" IN ('item_1', 'item_2', 'item_3', 'item_4', 'item_5', 'item_6', 'item_7', 'item_8');

UPDATE "Customer"
SET "dataOrigin" = 'SEED', "trainingEligible" = false
WHERE "id" = 'cust_rahul';

UPDATE "Order"
SET "dataOrigin" = 'SEED', "trainingEligible" = false
WHERE "orderNumber" = 'VM-1001' AND "businessId" = 'biz_1';

UPDATE "Payment"
SET "dataOrigin" = 'SEED', "trainingEligible" = false
WHERE "cashfreeOrderId" = 'cf_demo_order_1001';

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_non_live_training_ineligible"
  CHECK (
    "dataOrigin" IN ('LIVE', 'HISTORICAL_IMPORT', 'MANUAL')
    OR "trainingEligible" = false
  );

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_non_live_training_ineligible"
  CHECK (
    "dataOrigin" IN ('LIVE', 'HISTORICAL_IMPORT', 'MANUAL')
    OR "trainingEligible" = false
  );

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_non_live_training_ineligible"
  CHECK (
    "dataOrigin" IN ('LIVE', 'HISTORICAL_IMPORT', 'MANUAL')
    OR "trainingEligible" = false
  );

CREATE INDEX "MenuCategory_businessId_dataOrigin_trainingEligible_idx" ON "MenuCategory"("businessId", "dataOrigin", "trainingEligible");
CREATE INDEX "MenuItem_businessId_dataOrigin_trainingEligible_idx" ON "MenuItem"("businessId", "dataOrigin", "trainingEligible");
CREATE INDEX "Customer_businessId_dataOrigin_trainingEligible_idx" ON "Customer"("businessId", "dataOrigin", "trainingEligible");
CREATE INDEX "Order_businessId_dataOrigin_trainingEligible_idx" ON "Order"("businessId", "dataOrigin", "trainingEligible");
CREATE INDEX "Payment_businessId_dataOrigin_trainingEligible_idx" ON "Payment"("businessId", "dataOrigin", "trainingEligible");
CREATE INDEX "Order_businessId_scheduledFor_idx" ON "Order"("businessId", "scheduledFor");
CREATE INDEX "Order_businessId_status_scheduledFor_idx" ON "Order"("businessId", "status", "scheduledFor");
