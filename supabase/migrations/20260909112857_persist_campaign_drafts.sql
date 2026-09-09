CREATE TABLE "public"."CampaignDraft" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(1200) NOT NULL,
  "audience" VARCHAR(40) NOT NULL DEFAULT 'MARKETING_OPTED_IN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignDraft_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CampaignDraft_businessId_createdAt_idx" ON "public"."CampaignDraft"("businessId", "createdAt");
-- App sessions use server-side Prisma. Do not expose tenant drafts through the Data API.
ALTER TABLE "public"."CampaignDraft" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."CampaignDraft" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."CampaignDraft" TO service_role;
