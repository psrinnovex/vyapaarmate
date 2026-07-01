-- Add per-business WhatsApp Cloud API onboarding fields.
ALTER TABLE "Business"
ADD COLUMN "whatsappDisplayPhone" TEXT,
ADD COLUMN "whatsappPhoneNumberId" TEXT,
ADD COLUMN "whatsappWabaId" TEXT,
ADD COLUMN "whatsappAccessTokenEnc" TEXT,
ADD COLUMN "whatsappConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappLiveEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappApprovedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Business_whatsappPhoneNumberId_key" ON "Business"("whatsappPhoneNumberId");
CREATE INDEX "Business_whatsappDisplayPhone_idx" ON "Business"("whatsappDisplayPhone");
CREATE INDEX "Business_whatsappConnected_whatsappLiveEnabled_idx" ON "Business"("whatsappConnected", "whatsappLiveEnabled");
