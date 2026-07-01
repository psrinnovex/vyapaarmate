-- DropIndex
DROP INDEX "Business_isOpen_idx";

-- AlterTable
ALTER TABLE "BusinessServiceType" ALTER COLUMN "updatedAt" DROP DEFAULT;
