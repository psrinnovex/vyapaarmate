-- AlterTable
ALTER TABLE "WhatsappMessage" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "WhatsappMessage" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "WhatsappMessage" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "WhatsappMessage" ADD COLUMN "errorMessage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_providerMessageId_key" ON "WhatsappMessage"("providerMessageId");
