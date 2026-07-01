export type BusinessServiceTypeOption = {
  id: string;
  slug: string;
  name: string;
  description: string;
};

export const businessServiceTypeOptions = [
  {
    id: "bst_tiffin_center",
    slug: "tiffin-center",
    name: "Tiffin Center",
    description: "Daily meals, breakfast, lunch, dinner, and subscription food providers."
  },
  {
    id: "bst_restaurant",
    slug: "restaurant",
    name: "Restaurant",
    description: "Dine-in, pickup, and direct ordering restaurants."
  },
  {
    id: "bst_cloud_kitchen",
    slug: "cloud-kitchen",
    name: "Cloud Kitchen",
    description: "Pickup-focused kitchens and direct order food brands."
  },
  {
    id: "bst_home_bakery",
    slug: "home-bakery",
    name: "Home Bakery",
    description: "Home bakers, cake shops, and custom dessert businesses."
  },
  {
    id: "bst_cafe",
    slug: "cafe",
    name: "Cafe",
    description: "Coffee shops, tea shops, and snack counters."
  },
  {
    id: "bst_juice_shop",
    slug: "juice-shop",
    name: "Juice Shop",
    description: "Juice, smoothie, shake, and beverage counters."
  },
  {
    id: "bst_catering_service",
    slug: "catering-service",
    name: "Catering Service",
    description: "Party, event, and corporate catering services."
  },
  {
    id: "bst_sweets_snacks",
    slug: "sweets-snacks",
    name: "Sweets and Snacks",
    description: "Sweet shops, namkeen stores, and snack sellers."
  },
  {
    id: "bst_grocery_store",
    slug: "grocery-store",
    name: "Grocery Store",
    description: "Local grocery, kirana, and daily essentials retailers."
  },
  {
    id: "bst_salon_spa",
    slug: "salon-spa",
    name: "Salon and Spa",
    description: "Beauty salons, grooming studios, and spa services."
  },
  {
    id: "bst_laundry_service",
    slug: "laundry-service",
    name: "Laundry Service",
    description: "Laundry, dry cleaning, and ironing services."
  },
  {
    id: "bst_tailoring_boutique",
    slug: "tailoring-boutique",
    name: "Tailoring and Boutique",
    description: "Tailors, boutiques, alteration, and custom clothing services."
  },
  {
    id: "bst_home_services",
    slug: "home-services",
    name: "Home Services",
    description: "Cleaning, repair, appliance, and local home visit services."
  },
  {
    id: "bst_pharmacy",
    slug: "pharmacy",
    name: "Pharmacy",
    description: "Pharmacy, wellness, and health essentials stores."
  },
  {
    id: "bst_fitness_yoga",
    slug: "fitness-yoga-studio",
    name: "Fitness or Yoga Studio",
    description: "Fitness studios, yoga classes, and wellness training businesses."
  }
] satisfies BusinessServiceTypeOption[];

export const defaultBusinessServiceTypeName = businessServiceTypeOptions[0].name;

export function normalizeBusinessServiceType(value: string) {
  return value.trim().toLowerCase();
}

export function findBusinessServiceTypeOption(value: string) {
  const normalized = normalizeBusinessServiceType(value);
  return businessServiceTypeOptions.find(
    (option) =>
      normalizeBusinessServiceType(option.name) === normalized ||
      normalizeBusinessServiceType(option.slug) === normalized
  );
}
