-- CreateEnum
CREATE TYPE "MobilePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "AccountDeletionScope" AS ENUM ('CUSTOMER', 'STAFF', 'BUSINESS');

-- CreateEnum
CREATE TYPE "AccountDeletionStatus" AS ENUM ('AWAITING_VERIFICATION', 'REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AddColumn
ALTER TABLE "Order" ADD COLUMN "mobileRequestKeyHash" CHAR(64),
ADD COLUMN "mobileRequestBodyHash" CHAR(64);

-- CreateTable
CREATE TABLE "MobileAuthorizationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" VARCHAR(64) NOT NULL,
    "redirectUri" VARCHAR(500) NOT NULL,
    "codeChallenge" VARCHAR(128) NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" VARCHAR(64) NOT NULL,
    "platform" "MobilePlatform" NOT NULL,
    "deviceName" VARCHAR(100),
    "appVersion" VARCHAR(32),
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileRefreshToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "scope" "AccountDeletionScope" NOT NULL,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requesterUserId" TEXT,
    "businessId" TEXT,
    "idempotencyKeyHash" CHAR(64),
    "verificationTokenHash" CHAR(64),
    "verificationExpiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "reason" VARCHAR(500),
    "retentionNoticeVersion" VARCHAR(32) NOT NULL,
    "retentionNotice" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "retentionReviewAt" TIMESTAMP(3),
    "retentionPurgeAfter" TIMESTAMP(3),
    "retentionHoldUntil" TIMESTAMP(3),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileAuthorizationCode_codeHash_key" ON "MobileAuthorizationCode"("codeHash");

-- CreateIndex
CREATE INDEX "MobileAuthorizationCode_userId_expiresAt_idx" ON "MobileAuthorizationCode"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "MobileAuthorizationCode_expiresAt_usedAt_idx" ON "MobileAuthorizationCode"("expiresAt", "usedAt");

-- CreateIndex
CREATE INDEX "MobileSession_userId_revokedAt_idleExpiresAt_idx" ON "MobileSession"("userId", "revokedAt", "idleExpiresAt");

-- CreateIndex
CREATE INDEX "MobileSession_absoluteExpiresAt_idx" ON "MobileSession"("absoluteExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileRefreshToken_tokenHash_key" ON "MobileRefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MobileRefreshToken_sessionId_generation_key" ON "MobileRefreshToken"("sessionId", "generation");

-- CreateIndex
CREATE INDEX "MobileRefreshToken_sessionId_usedAt_revokedAt_idx" ON "MobileRefreshToken"("sessionId", "usedAt", "revokedAt");

-- CreateIndex
CREATE INDEX "MobileRefreshToken_expiresAt_idx" ON "MobileRefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_scope_status_scheduledFor_idx" ON "AccountDeletionRequest"("scope", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_requesterUserId_createdAt_idx" ON "AccountDeletionRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_businessId_status_createdAt_idx" ON "AccountDeletionRequest"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionRequest_idempotencyKeyHash_key" ON "AccountDeletionRequest"("idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionRequest_verificationTokenHash_key" ON "AccountDeletionRequest"("verificationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Order_mobileRequestKeyHash_key" ON "Order"("mobileRequestKeyHash");

-- AddForeignKey
ALTER TABLE "MobileAuthorizationCode" ADD CONSTRAINT "MobileAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileRefreshToken" ADD CONSTRAINT "MobileRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MobileSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep mobile credentials and deletion workflow state server-only in the Supabase-hosted database.
ALTER TABLE "MobileAuthorizationCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MobileSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MobileRefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountDeletionRequest" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "MobileAuthorizationCode" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "MobileSession" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "MobileRefreshToken" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "AccountDeletionRequest" FROM PUBLIC;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "MobileAuthorizationCode" FROM %I', app_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "MobileSession" FROM %I', app_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "MobileRefreshToken" FROM %I', app_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE "AccountDeletionRequest" FROM %I', app_role);
    END IF;
  END LOOP;
END $$;
