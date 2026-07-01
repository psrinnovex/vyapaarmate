-- Real AI Intelligence v1: first-party model lifecycle tables.
-- The application trains and serves these models through server-side Prisma only.
-- Supabase Data API access stays revoked; RLS policies are defense-in-depth if
-- a future migration deliberately grants authenticated table access.

-- CreateTable
CREATE TABLE "IntelligenceModelArtifact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "featuresJson" JSONB NOT NULL,
    "weightsJson" JSONB,
    "artifactJson" JSONB,
    "metricsJson" JSONB,
    "trainedAt" TIMESTAMP(3),
    "trainingDataStart" TIMESTAMP(3),
    "trainingDataEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceModelArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceTrainingRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rowsUsed" INTEGER NOT NULL DEFAULT 0,
    "trainRows" INTEGER NOT NULL DEFAULT 0,
    "validationRows" INTEGER NOT NULL DEFAULT 0,
    "metricsJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "IntelligenceTrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligencePrediction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "predictionJson" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "explanationJson" JSONB NOT NULL,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligencePrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceModelArtifact_businessId_modelType_version_key" ON "IntelligenceModelArtifact"("businessId", "modelType", "version");

-- CreateIndex
CREATE INDEX "IntelligenceModelArtifact_businessId_modelType_idx" ON "IntelligenceModelArtifact"("businessId", "modelType");

-- CreateIndex
CREATE INDEX "IntelligenceModelArtifact_businessId_modelType_status_idx" ON "IntelligenceModelArtifact"("businessId", "modelType", "status");

-- CreateIndex
CREATE INDEX "IntelligenceModelArtifact_businessId_status_createdAt_idx" ON "IntelligenceModelArtifact"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceModelArtifact_businessId_createdAt_idx" ON "IntelligenceModelArtifact"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceTrainingRun_businessId_modelType_idx" ON "IntelligenceTrainingRun"("businessId", "modelType");

-- CreateIndex
CREATE INDEX "IntelligenceTrainingRun_businessId_modelType_status_idx" ON "IntelligenceTrainingRun"("businessId", "modelType", "status");

-- CreateIndex
CREATE INDEX "IntelligenceTrainingRun_businessId_status_startedAt_idx" ON "IntelligenceTrainingRun"("businessId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "IntelligenceTrainingRun_businessId_startedAt_idx" ON "IntelligenceTrainingRun"("businessId", "startedAt");

-- CreateIndex
CREATE INDEX "IntelligencePrediction_businessId_modelType_idx" ON "IntelligencePrediction"("businessId", "modelType");

-- CreateIndex
CREATE INDEX "IntelligencePrediction_businessId_modelType_createdAt_idx" ON "IntelligencePrediction"("businessId", "modelType", "createdAt");

-- CreateIndex
CREATE INDEX "IntelligencePrediction_businessId_modelType_entityType_entityId_idx" ON "IntelligencePrediction"("businessId", "modelType", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntelligencePrediction_businessId_createdAt_idx" ON "IntelligencePrediction"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntelligenceModelArtifact" ADD CONSTRAINT "IntelligenceModelArtifact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceTrainingRun" ADD CONSTRAINT "IntelligenceTrainingRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligencePrediction" ADD CONSTRAINT "IntelligencePrediction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntelligenceModelArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntelligenceTrainingRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntelligencePrediction" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "IntelligenceModelArtifact", "IntelligenceTrainingRun", "IntelligencePrediction" FROM PUBLIC;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "IntelligenceModelArtifact", "IntelligenceTrainingRun", "IntelligencePrediction" FROM %I', app_role);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "IntelligenceModelArtifact tenant read"
ON "IntelligenceModelArtifact"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "User"
    WHERE "User"."id" = (SELECT auth.uid())::text
      AND "User"."businessId" = "IntelligenceModelArtifact"."businessId"
      AND "User"."role" IN ('OWNER', 'MANAGER')
  )
);

CREATE POLICY "IntelligenceTrainingRun tenant read"
ON "IntelligenceTrainingRun"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "User"
    WHERE "User"."id" = (SELECT auth.uid())::text
      AND "User"."businessId" = "IntelligenceTrainingRun"."businessId"
      AND "User"."role" IN ('OWNER', 'MANAGER')
  )
);

CREATE POLICY "IntelligencePrediction tenant read"
ON "IntelligencePrediction"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "User"
    WHERE "User"."id" = (SELECT auth.uid())::text
      AND "User"."businessId" = "IntelligencePrediction"."businessId"
      AND "User"."role" IN ('OWNER', 'MANAGER')
  )
);

DO $$
DECLARE
  live_table text;
BEGIN
  IF to_regprocedure('public.bhojzo_live_notify()') IS NOT NULL THEN
    FOREACH live_table IN ARRAY ARRAY[
      'IntelligenceModelArtifact',
      'IntelligenceTrainingRun',
      'IntelligencePrediction'
    ]
    LOOP
      IF to_regclass(format('public.%I', live_table)) IS NOT NULL THEN
        EXECUTE format('DROP TRIGGER IF EXISTS bhojzo_live_notify_trigger ON public.%I', live_table);
        EXECUTE format(
          'CREATE TRIGGER bhojzo_live_notify_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bhojzo_live_notify()',
          live_table
        );
      END IF;
    END LOOP;
  END IF;
END $$;
