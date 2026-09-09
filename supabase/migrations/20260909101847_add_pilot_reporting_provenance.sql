-- Add explicit provenance and optional pilot enrollment without changing access.
CREATE TYPE "PilotCohort" AS ENUM ('BENGALURU', 'ANDHRA_PRADESH');
ALTER TABLE "Business"
  ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE',
  ADD COLUMN "pilotCohort" "PilotCohort",
  ADD COLUMN "pilotEnrolledAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'LIVE';
-- Only the exact built-in fixture identities are classified here. Review imported
-- records before using them as traction; this is not an audit of historical sales.
UPDATE "Business" SET "dataOrigin" = 'DEMO'
WHERE "id" IN ('biz_1', 'biz_2', 'biz_3')
  OR "slug" IN ('sri-sai-tiffins', 'fresh-bowl-cloud-kitchen', 'sweet-cravings-home-bakery');
UPDATE "Business" SET "dataOrigin" = 'TEST' WHERE "slug" = 'audit-business';
UPDATE "Subscription" s SET "dataOrigin" = b."dataOrigin"
FROM "Business" b WHERE s."businessId" = b."id" AND b."dataOrigin" IN ('DEMO', 'SEED', 'TEST');
CREATE INDEX "Business_pilotCohort_dataOrigin_idx" ON "Business" ("pilotCohort", "dataOrigin");
CREATE INDEX "Subscription_dataOrigin_status_paymentStatus_idx" ON "Subscription" ("dataOrigin", "status", "paymentStatus");
