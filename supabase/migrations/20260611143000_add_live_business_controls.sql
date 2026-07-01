-- AlterEnum
ALTER TYPE "FoodType" ADD VALUE 'NOT_APPLICABLE';
ALTER TYPE "OrderType" ADD VALUE 'DINE_IN';
ALTER TYPE "OrderType" ADD VALUE 'SERVICE_AT_LOCATION';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "isOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "businessHours" TEXT NOT NULL DEFAULT 'Open today';
ALTER TABLE "Business" ADD COLUMN "minimumOrder" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN "latitude" DECIMAL(9,6);
ALTER TABLE "Business" ADD COLUMN "longitude" DECIMAL(9,6);
ALTER TABLE "Business" ADD COLUMN "serviceRadiusKm" DECIMAL(7,2) NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN "acceptsPickup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "acceptsDineIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "acceptsServiceAtLocation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "allowsPayLater" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerLatitude" DECIMAL(9,6);
ALTER TABLE "Order" ADD COLUMN "customerLongitude" DECIMAL(9,6);
ALTER TABLE "Order" ADD COLUMN "distanceKm" DECIMAL(7,2);

-- CreateIndex
CREATE INDEX "Business_isOpen_idx" ON "Business"("isOpen");
