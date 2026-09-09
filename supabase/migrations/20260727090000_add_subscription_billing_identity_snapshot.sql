-- Preserve the billing identity used when a subscription checkout is created.
ALTER TABLE "Subscription" ADD COLUMN "billingBusinessSnapshot" JSONB;

-- Historical identity was not stored separately. Freeze the best available
-- business identity at migration time so later profile edits cannot rewrite it.
UPDATE "Subscription" AS subscription
SET "billingBusinessSnapshot" = jsonb_build_object(
  'businessName', business."name",
  'ownerName', business."ownerName",
  'address', business."address",
  'city', business."city",
  'state', business."state",
  'email', business."email",
  'phone', business."phone"
)
FROM "Business" AS business
WHERE subscription."businessId" = business."id"
  AND subscription."billingBusinessSnapshot" IS NULL;
