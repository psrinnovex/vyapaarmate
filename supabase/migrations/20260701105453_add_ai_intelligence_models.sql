-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suggestedAction" TEXT,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHealthSnapshot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "salesTrend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repeatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingPaymentRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeCustomerRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerIntelligenceScore" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "repeatScore" INTEGER NOT NULL,
    "churnRisk" INTEGER NOT NULL DEFAULT 0,
    "preferredCategory" TEXT,
    "recommendedAction" TEXT NOT NULL,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIntelligenceScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandForecast" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "predictedQuantity" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPriority" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountPending" DECIMAL(10,2) NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "suggestedMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPriority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIInsight_businessId_type_createdAt_idx" ON "AIInsight"("businessId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AIInsight_businessId_severity_createdAt_idx" ON "AIInsight"("businessId", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessHealthSnapshot_businessId_createdAt_idx" ON "BusinessHealthSnapshot"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessHealthSnapshot_businessId_score_idx" ON "BusinessHealthSnapshot"("businessId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIntelligenceScore_businessId_customerId_key" ON "CustomerIntelligenceScore"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerIntelligenceScore_businessId_repeatScore_idx" ON "CustomerIntelligenceScore"("businessId", "repeatScore");

-- CreateIndex
CREATE INDEX "CustomerIntelligenceScore_businessId_churnRisk_idx" ON "CustomerIntelligenceScore"("businessId", "churnRisk");

-- CreateIndex
CREATE INDEX "CustomerIntelligenceScore_customerId_idx" ON "CustomerIntelligenceScore"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandForecast_businessId_productId_forecastDate_timeSlot_key" ON "DemandForecast"("businessId", "productId", "forecastDate", "timeSlot");

-- CreateIndex
CREATE INDEX "DemandForecast_businessId_forecastDate_timeSlot_idx" ON "DemandForecast"("businessId", "forecastDate", "timeSlot");

-- CreateIndex
CREATE INDEX "DemandForecast_productId_idx" ON "DemandForecast"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPriority_businessId_customerId_orderId_key" ON "PaymentPriority"("businessId", "customerId", "orderId");

-- CreateIndex
CREATE INDEX "PaymentPriority_businessId_priorityScore_createdAt_idx" ON "PaymentPriority"("businessId", "priorityScore", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentPriority_customerId_idx" ON "PaymentPriority"("customerId");

-- CreateIndex
CREATE INDEX "PaymentPriority_orderId_idx" ON "PaymentPriority"("orderId");

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHealthSnapshot" ADD CONSTRAINT "BusinessHealthSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIntelligenceScore" ADD CONSTRAINT "CustomerIntelligenceScore_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIntelligenceScore" ADD CONSTRAINT "CustomerIntelligenceScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecast" ADD CONSTRAINT "DemandForecast_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecast" ADD CONSTRAINT "DemandForecast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPriority" ADD CONSTRAINT "PaymentPriority_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPriority" ADD CONSTRAINT "PaymentPriority_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPriority" ADD CONSTRAINT "PaymentPriority_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIInsight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessHealthSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerIntelligenceScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemandForecast" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentPriority" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "AIInsight", "BusinessHealthSnapshot", "CustomerIntelligenceScore", "DemandForecast", "PaymentPriority" FROM PUBLIC;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "AIInsight", "BusinessHealthSnapshot", "CustomerIntelligenceScore", "DemandForecast", "PaymentPriority" FROM %I', app_role);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  live_table text;
BEGIN
  IF to_regprocedure('public.bhojzo_live_notify()') IS NOT NULL THEN
    FOREACH live_table IN ARRAY ARRAY[
      'AIInsight',
      'BusinessHealthSnapshot',
      'CustomerIntelligenceScore',
      'DemandForecast',
      'PaymentPriority'
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

ALTER TABLE "PlatformPaymentSettings" ALTER COLUMN "upiName" SET DEFAULT 'PSHR INNOVEX PRIVATE LIMITED';

UPDATE "PlatformPaymentSettings"
SET "upiName" = 'PSHR INNOVEX PRIVATE LIMITED'
WHERE "upiName" = 'PSHR Innovex Pvt Ltd';
