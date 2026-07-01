DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Business"
    GROUP BY "email"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique Business.email constraint because duplicate business emails already exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Business"
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique Business.phone constraint because duplicate business phones already exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Business_email_key" ON "Business"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Business_phone_key" ON "Business"("phone");
