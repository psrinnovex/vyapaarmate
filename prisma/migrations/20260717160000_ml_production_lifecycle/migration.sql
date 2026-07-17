-- Production ML lifecycle controls. This migration is additive and keeps the
-- existing artifact JSON compatible for rollback while introducing explicit
-- shadow/active promotion, monitoring, and training leases.

-- Resolution time is required for leakage-safe payment outcome labels. The
-- application already updates Payment rows whenever provider state changes.
ALTER TABLE "Payment"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "IntelligenceModelArtifact"
  ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'shadow',
  ADD COLUMN "promotionEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "baselineMetricsJson" JSONB,
  ADD COLUMN "evaluationJson" JSONB,
  ADD COLUMN "driftStatus" TEXT NOT NULL DEFAULT 'not_checked',
  ADD COLUMN "driftScore" DOUBLE PRECISION,
  ADD COLUMN "driftJson" JSONB,
  ADD COLUMN "lastDriftCheckedAt" TIMESTAMP(3),
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "retiredAt" TIMESTAMP(3),
  ADD COLUMN "rollbackReason" TEXT;

ALTER TABLE "IntelligenceTrainingRun"
  ADD COLUMN "trigger" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "candidateVersion" TEXT,
  ADD COLUMN "promotionDecision" JSONB,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3);

-- Preserve only the newest previously-trained artifact as active. Older
-- compatible artifacts remain available as rollback candidates.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "businessId", "modelType"
      ORDER BY "trainedAt" DESC NULLS LAST, "createdAt" DESC
    ) AS rank
  FROM "IntelligenceModelArtifact"
  WHERE "status" = 'trained'
)
UPDATE "IntelligenceModelArtifact" AS artifact
SET
  "lifecycleStatus" = CASE WHEN ranked.rank = 1 THEN 'active' ELSE 'retired' END,
  "promotionEligible" = true,
  "promotedAt" = CASE WHEN ranked.rank = 1 THEN COALESCE(artifact."trainedAt", artifact."createdAt") ELSE NULL END,
  "retiredAt" = CASE WHEN ranked.rank = 1 THEN NULL ELSE CURRENT_TIMESTAMP END
FROM ranked
WHERE artifact."id" = ranked."id";

-- A deployment is a safe boundary for any abandoned pre-lease training row.
UPDATE "IntelligenceTrainingRun"
SET
  "status" = 'failed',
  "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
  "errorMessage" = COALESCE("errorMessage", 'Training lease closed by production lifecycle migration.')
WHERE "status" = 'training';

ALTER TABLE "IntelligenceModelArtifact"
  ADD CONSTRAINT "IntelligenceModelArtifact_lifecycle_status_check"
  CHECK ("lifecycleStatus" IN ('shadow', 'active', 'retired', 'rolled_back')),
  ADD CONSTRAINT "IntelligenceModelArtifact_drift_status_check"
  CHECK ("driftStatus" IN ('not_checked', 'insufficient_data', 'stable', 'warning', 'critical'));

CREATE UNIQUE INDEX "IntelligenceModelArtifact_one_active_per_model_key"
  ON "IntelligenceModelArtifact"("businessId", "modelType")
  WHERE "lifecycleStatus" = 'active';

CREATE UNIQUE INDEX "IntelligenceTrainingRun_one_running_per_model_key"
  ON "IntelligenceTrainingRun"("businessId", "modelType")
  WHERE "status" = 'training';

CREATE INDEX "IntelligenceModelArtifact_businessId_modelType_lifecycleStatus_idx"
  ON "IntelligenceModelArtifact"("businessId", "modelType", "lifecycleStatus");

CREATE INDEX "IntelligenceModelArtifact_businessId_driftStatus_lastDriftCheckedAt_idx"
  ON "IntelligenceModelArtifact"("businessId", "driftStatus", "lastDriftCheckedAt");

CREATE INDEX "IntelligenceTrainingRun_status_leaseExpiresAt_idx"
  ON "IntelligenceTrainingRun"("status", "leaseExpiresAt");
