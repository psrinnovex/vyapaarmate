export const activeFulfillmentModes = ["PICKUP", "DINE_IN", "SERVICE_AT_LOCATION"] as const;

export type ActiveFulfillmentMode = (typeof activeFulfillmentModes)[number];

export const fulfillmentLabels: Record<ActiveFulfillmentMode, string> = {
  PICKUP: "Pickup",
  DINE_IN: "Dine-in",
  SERVICE_AT_LOCATION: "At my location"
};

export type FulfillmentFlags = {
  acceptsPickup: boolean;
  acceptsDineIn: boolean;
  acceptsServiceAtLocation: boolean;
};

export type BusinessFulfillmentProfile = {
  allowedModes: ActiveFulfillmentMode[];
  defaultModes: ActiveFulfillmentMode[];
  labels: Record<ActiveFulfillmentMode, string>;
};

export const fulfillmentModeFlagNames: Record<ActiveFulfillmentMode, keyof FulfillmentFlags> = {
  PICKUP: "acceptsPickup",
  DINE_IN: "acceptsDineIn",
  SERVICE_AT_LOCATION: "acceptsServiceAtLocation"
};

const foodBusinessTerms = [
  "bakery",
  "biryani",
  "catering",
  "cafe",
  "cake",
  "cloud kitchen",
  "food",
  "hotel",
  "juice",
  "kitchen",
  "meal",
  "restaurant",
  "snack",
  "sweet",
  "tiffin"
];

const pickupOnlyFoodTerms = ["cloud kitchen", "home bakery"];
const cateringTerms = ["catering"];
const retailBusinessTerms = ["grocery", "kirana", "pharmacy", "chemist", "retail"];
const salonBusinessTerms = ["salon", "saloon", "spa", "grooming", "beauty"];
const laundryBusinessTerms = ["laundry", "dry clean", "ironing"];
const tailoringBusinessTerms = ["tailor", "tailoring", "boutique", "alteration"];
const homeServiceBusinessTerms = [
  "home service",
  "cleaning",
  "repair",
  "appliance",
  "plumber",
  "electrician"
];
const studioBusinessTerms = ["fitness", "yoga", "class", "studio"];

function includesAny(normalized: string, terms: string[]) {
  return terms.some((term) => normalized.includes(term));
}

export function isFoodBusinessType(businessType: string) {
  const normalized = businessType.toLowerCase();
  return foodBusinessTerms.some((term) => normalized.includes(term));
}

export function isCateringBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), cateringTerms);
}

export function isRetailBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), retailBusinessTerms);
}

export function isSalonBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), salonBusinessTerms);
}

export function isLaundryBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), laundryBusinessTerms);
}

export function isTailoringBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), tailoringBusinessTerms);
}

export function isHomeServiceBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), homeServiceBusinessTerms);
}

export function isStudioBusinessType(businessType: string) {
  return includesAny(businessType.trim().toLowerCase(), studioBusinessTerms);
}

export function requiresScheduledServiceTime(businessType: string) {
  return (
    isSalonBusinessType(businessType) ||
    isStudioBusinessType(businessType) ||
    isCateringBusinessType(businessType) ||
    isHomeServiceBusinessType(businessType)
  );
}

export function getBusinessFulfillmentProfile(businessType: string): BusinessFulfillmentProfile {
  const normalized = businessType.trim().toLowerCase();
  const labels = { ...fulfillmentLabels };

  if (isCateringBusinessType(businessType)) {
    return {
      allowedModes: ["PICKUP", "SERVICE_AT_LOCATION"],
      defaultModes: ["SERVICE_AT_LOCATION"],
      labels: {
        ...labels,
        PICKUP: "Food pickup",
        SERVICE_AT_LOCATION: "Event catering"
      }
    };
  }

  if (includesAny(normalized, pickupOnlyFoodTerms)) {
    return {
      allowedModes: ["PICKUP"],
      defaultModes: ["PICKUP"],
      labels
    };
  }

  if (isFoodBusinessType(businessType)) {
    return {
      allowedModes: ["PICKUP", "DINE_IN"],
      defaultModes: ["PICKUP", "DINE_IN"],
      labels
    };
  }

  if (isRetailBusinessType(businessType)) {
    return {
      allowedModes: ["PICKUP", "SERVICE_AT_LOCATION"],
      defaultModes: ["PICKUP"],
      labels: {
        ...labels,
        PICKUP: "Store pickup",
        SERVICE_AT_LOCATION: "Home delivery"
      }
    };
  }

  if (isSalonBusinessType(businessType)) {
    return {
      allowedModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
      defaultModes: ["DINE_IN"],
      labels: {
        ...labels,
        DINE_IN: "Visit salon",
        SERVICE_AT_LOCATION: "Home service"
      }
    };
  }

  if (isLaundryBusinessType(businessType)) {
    return {
      allowedModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
      defaultModes: ["DINE_IN"],
      labels: {
        ...labels,
        DINE_IN: "Visit laundry",
        SERVICE_AT_LOCATION: "Home pickup"
      }
    };
  }

  if (isTailoringBusinessType(businessType)) {
    return {
      allowedModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
      defaultModes: ["DINE_IN"],
      labels: {
        ...labels,
        DINE_IN: "Visit tailor",
        SERVICE_AT_LOCATION: "Home visit"
      }
    };
  }

  if (isHomeServiceBusinessType(businessType)) {
    return {
      allowedModes: ["SERVICE_AT_LOCATION"],
      defaultModes: ["SERVICE_AT_LOCATION"],
      labels: {
        ...labels,
        SERVICE_AT_LOCATION: "At your location"
      }
    };
  }

  if (isStudioBusinessType(businessType)) {
    return {
      allowedModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
      defaultModes: ["DINE_IN"],
      labels: {
        ...labels,
        DINE_IN: "At studio",
        SERVICE_AT_LOCATION: "At your location"
      }
    };
  }

  return {
    allowedModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
    defaultModes: ["DINE_IN"],
    labels: {
      ...labels,
      DINE_IN: "At business",
      SERVICE_AT_LOCATION: "At your location"
    }
  };
}

export function defaultFulfillmentModesForBusinessType(businessType: string): ActiveFulfillmentMode[] {
  return [...getBusinessFulfillmentProfile(businessType).defaultModes];
}

export function defaultFulfillmentFlagsForBusinessType(businessType: string): FulfillmentFlags {
  const modes = new Set(defaultFulfillmentModesForBusinessType(businessType));
  return {
    acceptsPickup: modes.has("PICKUP"),
    acceptsDineIn: modes.has("DINE_IN"),
    acceptsServiceAtLocation: modes.has("SERVICE_AT_LOCATION")
  };
}

export function isFulfillmentModeAllowedForBusinessType(businessType: string, mode: ActiveFulfillmentMode) {
  return getBusinessFulfillmentProfile(businessType).allowedModes.includes(mode);
}

export function filterFulfillmentFlagsForBusinessType(
  businessType: string,
  flags: FulfillmentFlags
): FulfillmentFlags {
  return {
    acceptsPickup: flags.acceptsPickup && isFulfillmentModeAllowedForBusinessType(businessType, "PICKUP"),
    acceptsDineIn: flags.acceptsDineIn && isFulfillmentModeAllowedForBusinessType(businessType, "DINE_IN"),
    acceptsServiceAtLocation:
      flags.acceptsServiceAtLocation && isFulfillmentModeAllowedForBusinessType(businessType, "SERVICE_AT_LOCATION")
  };
}

export function fulfillmentLabelForBusinessType(businessType: string, mode: ActiveFulfillmentMode) {
  return getBusinessFulfillmentProfile(businessType).labels[mode] ?? fulfillmentLabels[mode];
}

export function fulfillmentSummaryForBusinessType(businessType: string, modes: ActiveFulfillmentMode[]) {
  return modes.map((mode) => fulfillmentLabelForBusinessType(businessType, mode)).join(" / ");
}

export function fulfillmentModesFromFlags(input: {
  businessType: string;
  acceptsPickup: boolean;
  acceptsDineIn: boolean;
  acceptsServiceAtLocation: boolean;
}): ActiveFulfillmentMode[] {
  const profile = getBusinessFulfillmentProfile(input.businessType);
  const modes: ActiveFulfillmentMode[] = [];
  if (input.acceptsPickup && profile.allowedModes.includes("PICKUP")) modes.push("PICKUP");
  if (input.acceptsDineIn && profile.allowedModes.includes("DINE_IN")) modes.push("DINE_IN");
  if (input.acceptsServiceAtLocation && profile.allowedModes.includes("SERVICE_AT_LOCATION")) {
    modes.push("SERVICE_AT_LOCATION");
  }
  const anyRequested = input.acceptsPickup || input.acceptsDineIn || input.acceptsServiceAtLocation;
  return modes.length || !anyRequested ? modes : [...profile.defaultModes];
}

export function fulfillmentFeeForOrder(input: {
  fee: number;
  orderType: ActiveFulfillmentMode;
  fulfillmentModes: ActiveFulfillmentMode[];
  hasItems?: boolean;
}) {
  const fee = Math.max(0, Math.round((Number.isFinite(input.fee) ? input.fee : 0) * 100) / 100);
  if (fee <= 0 || input.hasItems === false) return 0;

  const hasCustomerLocationMode = input.fulfillmentModes.includes("SERVICE_AT_LOCATION");
  if (!hasCustomerLocationMode) return fee;

  return input.orderType === "SERVICE_AT_LOCATION" ? fee : 0;
}

export function calculateDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isValidCoordinate(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
