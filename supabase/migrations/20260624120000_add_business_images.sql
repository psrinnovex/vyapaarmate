-- CreateTable
CREATE TABLE "BusinessImage" (
    "businessId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessImage_pkey" PRIMARY KEY ("businessId")
);

-- Images are served through the application route, not the Supabase Data API.
ALTER TABLE "BusinessImage" ENABLE ROW LEVEL SECURITY;

-- AddForeignKey
ALTER TABLE "BusinessImage" ADD CONSTRAINT "BusinessImage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
