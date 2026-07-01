-- CreateTable
CREATE TABLE "BusinessServiceType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessServiceType_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "businessServiceTypeId" TEXT;

-- Seed lookup values used by the onboarding and dashboard dropdowns.
INSERT INTO "BusinessServiceType" ("id", "slug", "name", "description", "sortOrder")
VALUES
  ('bst_tiffin_center', 'tiffin-center', 'Tiffin Center', 'Daily meals, breakfast, lunch, dinner, and subscription food providers.', 10),
  ('bst_restaurant', 'restaurant', 'Restaurant', 'Dine-in, pickup, and direct ordering restaurants.', 20),
  ('bst_cloud_kitchen', 'cloud-kitchen', 'Cloud Kitchen', 'Delivery-first kitchens and dark kitchen brands.', 30),
  ('bst_home_bakery', 'home-bakery', 'Home Bakery', 'Home bakers, cake shops, and custom dessert businesses.', 40),
  ('bst_cafe', 'cafe', 'Cafe', 'Coffee shops, tea shops, and snack counters.', 50),
  ('bst_juice_shop', 'juice-shop', 'Juice Shop', 'Juice, smoothie, shake, and beverage counters.', 60),
  ('bst_catering_service', 'catering-service', 'Catering Service', 'Party, event, and corporate catering services.', 70),
  ('bst_sweets_snacks', 'sweets-snacks', 'Sweets and Snacks', 'Sweet shops, namkeen stores, and snack sellers.', 80),
  ('bst_grocery_store', 'grocery-store', 'Grocery Store', 'Local grocery, kirana, and daily essentials retailers.', 90),
  ('bst_salon_spa', 'salon-spa', 'Salon and Spa', 'Beauty salons, grooming studios, and spa services.', 100),
  ('bst_laundry_service', 'laundry-service', 'Laundry Service', 'Laundry, dry cleaning, and ironing services.', 110),
  ('bst_tailoring_boutique', 'tailoring-boutique', 'Tailoring and Boutique', 'Tailors, boutiques, alteration, and custom clothing services.', 120),
  ('bst_home_services', 'home-services', 'Home Services', 'Cleaning, repair, appliance, and local home visit services.', 130),
  ('bst_pharmacy', 'pharmacy', 'Pharmacy', 'Pharmacy, wellness, and health essentials stores.', 140),
  ('bst_fitness_yoga', 'fitness-yoga-studio', 'Fitness or Yoga Studio', 'Fitness studios, yoga classes, and wellness training businesses.', 150);

UPDATE "Business"
SET "businessServiceTypeId" = matched."id",
    "businessType" = matched."name"
FROM "BusinessServiceType" AS matched
WHERE lower("Business"."businessType") = lower(matched."name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessServiceType_slug_key" ON "BusinessServiceType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessServiceType_name_key" ON "BusinessServiceType"("name");

-- CreateIndex
CREATE INDEX "BusinessServiceType_isActive_sortOrder_idx" ON "BusinessServiceType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Business_businessServiceTypeId_idx" ON "Business"("businessServiceTypeId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_businessServiceTypeId_fkey" FOREIGN KEY ("businessServiceTypeId") REFERENCES "BusinessServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for Supabase Data API exposure, if this public lookup table is ever exposed directly.
ALTER TABLE "BusinessServiceType" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "BusinessServiceType_select_active"
ON "BusinessServiceType"
FOR SELECT
USING ("isActive" = true);
