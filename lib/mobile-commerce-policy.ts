const mobilePhysicalServiceTypeSlugs = new Set([
  "tiffin-center",
  "restaurant",
  "cloud-kitchen",
  "home-bakery",
  "cafe",
  "juice-shop",
  "catering-service",
  "sweets-snacks",
  "grocery-store",
  "salon-spa",
  "laundry-service",
  "tailoring-boutique",
  "home-services"
]);

const regulatedServiceTypeSlugs = new Set(["pharmacy"]);
const physicalFulfillmentModes = new Set(["PICKUP", "DELIVERY", "DINE_IN", "SERVICE_AT_LOCATION"]);
const regulatedItemPattern =
  /\b(alcohol|beer|wine|whisk(?:e)?y|vodka|rum|tobacco|cigarette|cigar|nicotine|vape|hookah|controlled\s+substance|prescription|medicine|pharmaceutical)\b/i;

export type MobileCommerceItemClassification = { name: string; category: string };

export function isMobilePhysicalServiceType(serviceTypeSlug: string | null | undefined) {
  return Boolean(serviceTypeSlug && mobilePhysicalServiceTypeSlugs.has(serviceTypeSlug.trim().toLowerCase()));
}

export function isRegulatedMobileServiceType(serviceTypeSlug: string | null | undefined) {
  return Boolean(serviceTypeSlug && regulatedServiceTypeSlugs.has(serviceTypeSlug.trim().toLowerCase()));
}

export function hasRegulatedMobileItem(items: readonly MobileCommerceItemClassification[]) {
  return items.some((item) => regulatedItemPattern.test(`${item.category} ${item.name}`));
}

export function classifyMobileExternalPayment(input: {
  serviceTypeSlug: string | null | undefined;
  fulfillmentMode: string | null | undefined;
  items: readonly MobileCommerceItemClassification[];
}) {
  const slug = input.serviceTypeSlug?.trim().toLowerCase() ?? "";
  if (isRegulatedMobileServiceType(slug) || hasRegulatedMobileItem(input.items)) {
    return { allowed: false, code: "MOBILE_REGULATED_GOODS_NOT_AVAILABLE" } as const;
  }
  if (!isMobilePhysicalServiceType(slug) || !input.fulfillmentMode || !physicalFulfillmentModes.has(input.fulfillmentMode)) {
    return { allowed: false, code: "MOBILE_EXTERNAL_PAYMENT_NOT_ALLOWED" } as const;
  }
  return { allowed: true, code: null } as const;
}

export function looksLikeRegulatedBusinessLabel(value: string) {
  return /\b(pharmacy|chemist|medicine|pharmaceutical)\b/i.test(value);
}

export const mobileCommercePolicyInternals = {
  mobilePhysicalServiceTypeSlugs,
  physicalFulfillmentModes,
  regulatedItemPattern
};
