ALTER TABLE public."AccountDeletionRequest"
ADD COLUMN "retentionLastReviewedAt" TIMESTAMP(3),
ADD COLUMN "retentionReviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "retentionPurgedAt" TIMESTAMP(3),
ADD COLUMN "retentionHoldReason" VARCHAR(500);

CREATE INDEX "AccountDeletionRequest_status_retentionReviewAt_retentionPurgedAt_idx"
ON public."AccountDeletionRequest"("status", "retentionReviewAt", "retentionPurgedAt");

CREATE INDEX "AccountDeletionRequest_status_retentionPurgeAfter_retentionPurgedAt_idx"
ON public."AccountDeletionRequest"("status", "retentionPurgeAfter", "retentionPurgedAt");
