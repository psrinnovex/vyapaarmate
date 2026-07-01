-- Existing accounts predate registration verification and remain usable.
ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

UPDATE "User"
SET
  "emailVerifiedAt" = "createdAt",
  "phoneVerifiedAt" = CASE WHEN "phone" IS NULL THEN NULL ELSE "createdAt" END;

CREATE TABLE "RegistrationVerification" (
  "userId" TEXT NOT NULL,
  "emailCodeHash" TEXT NOT NULL,
  "emailCodeExpiresAt" TIMESTAMP(3) NOT NULL,
  "resendAvailableAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RegistrationVerification_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "RegistrationVerification_emailCodeExpiresAt_idx"
ON "RegistrationVerification"("emailCodeExpiresAt");

ALTER TABLE "RegistrationVerification"
ADD CONSTRAINT "RegistrationVerification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
