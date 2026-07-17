import { businessServiceTypeOptions } from "@/lib/business-service-types";

export const intelligenceBusinessFamilies = ["food", "retail", "appointment", "service_job"] as const;
export type IntelligenceBusinessFamily = (typeof intelligenceBusinessFamilies)[number];

export type IntelligenceBusinessProfile = {
  businessType: string;
  family: IntelligenceBusinessFamily;
  retentionHorizonDays: number;
  demandCadence: "daily";
};

const profileBySlug: Record<string, Omit<IntelligenceBusinessProfile, "businessType">> = {
  "tiffin-center": { family: "food", retentionHorizonDays: 30, demandCadence: "daily" },
  restaurant: { family: "food", retentionHorizonDays: 30, demandCadence: "daily" },
  "cloud-kitchen": { family: "food", retentionHorizonDays: 30, demandCadence: "daily" },
  "home-bakery": { family: "food", retentionHorizonDays: 45, demandCadence: "daily" },
  cafe: { family: "food", retentionHorizonDays: 30, demandCadence: "daily" },
  "juice-shop": { family: "food", retentionHorizonDays: 30, demandCadence: "daily" },
  "catering-service": { family: "appointment", retentionHorizonDays: 60, demandCadence: "daily" },
  "sweets-snacks": { family: "food", retentionHorizonDays: 30, demandCadence: "daily" },
  "grocery-store": { family: "retail", retentionHorizonDays: 45, demandCadence: "daily" },
  "salon-spa": { family: "appointment", retentionHorizonDays: 45, demandCadence: "daily" },
  "laundry-service": { family: "service_job", retentionHorizonDays: 60, demandCadence: "daily" },
  "tailoring-boutique": { family: "service_job", retentionHorizonDays: 60, demandCadence: "daily" },
  "home-services": { family: "service_job", retentionHorizonDays: 60, demandCadence: "daily" },
  pharmacy: { family: "retail", retentionHorizonDays: 45, demandCadence: "daily" },
  "fitness-yoga-studio": { family: "appointment", retentionHorizonDays: 60, demandCadence: "daily" }
};

export const supportedIntelligenceBusinessProfiles = businessServiceTypeOptions.map<IntelligenceBusinessProfile>((option) => {
  const profile = profileBySlug[option.slug];
  if (!profile) throw new Error(`Missing intelligence profile for supported business type ${option.name}.`);
  return { businessType: option.name, ...profile };
});

function normalized(value: string) {
  return value.trim().toLowerCase();
}

export function intelligenceBusinessProfile(businessType: string): IntelligenceBusinessProfile {
  const exact = supportedIntelligenceBusinessProfiles.find(
    (profile) => normalized(profile.businessType) === normalized(businessType)
  );
  if (exact) return exact;

  const value = normalized(businessType);
  if (/salon|spa|fitness|yoga|studio|cater/.test(value)) {
    return { businessType, family: "appointment", retentionHorizonDays: 60, demandCadence: "daily" };
  }
  if (/laundr|tailor|boutique|repair|clean|home service/.test(value)) {
    return { businessType, family: "service_job", retentionHorizonDays: 60, demandCadence: "daily" };
  }
  if (/grocery|kirana|pharmacy|retail|store/.test(value)) {
    return { businessType, family: "retail", retentionHorizonDays: 45, demandCadence: "daily" };
  }
  return { businessType, family: "food", retentionHorizonDays: 30, demandCadence: "daily" };
}
