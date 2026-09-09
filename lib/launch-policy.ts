const normalizedLaunchMarket = (process.env.NEXT_PUBLIC_LAUNCH_MARKET ?? "pilot-cohorts")
  .trim()
  .toLowerCase();

export const launchMarketRestricted = !["all", "india", "national"].includes(normalizedLaunchMarket);
export const launchMarketIncludesAndhraPradesh = ["pilot-cohorts", "bengaluru-ap"].includes(normalizedLaunchMarket);
export const launchSingleCityRestricted = launchMarketRestricted && !launchMarketIncludesAndhraPradesh;

const normalizedLaunchOfferFlag = (process.env.NEXT_PUBLIC_BENGALURU_LAUNCH_OFFER ?? "true")
  .trim()
  .toLowerCase();
const launchOfferEnabled = !["false", "0", "off", "no"].includes(normalizedLaunchOfferFlag);

export const launchMarket = {
  city: "Bengaluru",
  familiarName: "Bangalore",
  displayName: launchMarketIncludesAndhraPradesh ? "Bengaluru and Andhra Pradesh" : "Bengaluru (Bangalore)",
  state: "Karnataka",
  country: "India",
  center: {
    latitude: 12.9716,
    longitude: 77.5946
  },
  maximumBusinessDistanceKm: 50
} as const;

export const launchOffer = {
  enabled: launchOfferEnabled,
  publiclyAdvertised: launchOfferEnabled && launchSingleCityRestricted,
  code: "BENGALURU_LAUNCH_80",
  name: "Bengaluru launch offer",
  discountPercent: 80,
  discountLabel: "80% off monthly subscription",
  standardSetupFeeMinimum: 4999,
  standardSetupFeeMaximum: 14999
} as const;

export const launchAreasServed = !launchMarketRestricted
  ? [{ "@type": "Country", name: "India" }]
  : [
      { "@type": "City", name: "Bengaluru", containedInPlace: { "@type": "State", name: "Karnataka" } },
      ...(launchMarketIncludesAndhraPradesh ? [{ "@type": "State", name: "Andhra Pradesh" }] : [])
    ];

const launchCityAliases = new Set([
  "bangalore",
  "bangalore city",
  "bangalore urban",
  "bengaluru",
  "bengaluru city",
  "bengaluru urban"
]);

const launchStateAliases = new Set(["ka", "karnataka"]);
const andhraPradeshAliases = new Set(["ap", "andhra pradesh"]);

export function matchesAndhraPradeshState(value: unknown) {
  return andhraPradeshAliases.has(normalizeLocationName(value));
}

export function canonicalLaunchState(value: string) {
  if (matchesAndhraPradeshState(value)) return "Andhra Pradesh";
  return matchesLaunchState(value) ? "Karnataka" : value.trim();
}

// A coarse pin sanity check, not an administrative boundary lookup. The stated
// city/state and KYC address still require verification before merchant approval.
export function isInsideAndhraPradeshPilotArea(latitude: unknown, longitude: unknown) {
  if (!validCoordinates(latitude, longitude)) return false;
  const lat = Number(latitude);
  const lon = Number(longitude);
  return lat >= 12.6 && lat <= 19.95 && lon >= 76.75 && lon <= 84.8 && !isInsideBengaluruLaunchArea(lat, lon);
}

export function pilotCohortForLocation(location: LaunchBusinessLocation): "BENGALURU" | "ANDHRA_PRADESH" | null {
  if (matchesAndhraPradeshState(location.state)) return "ANDHRA_PRADESH";
  if (matchesLaunchCity(location.city) && matchesLaunchState(location.state)) return "BENGALURU";
  return null;
}

function normalizeLocationName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function validCoordinates(latitude: unknown, longitude: unknown) {
  const resolvedLatitude = numberOrNull(latitude);
  const resolvedLongitude = numberOrNull(longitude);
  return (
    resolvedLatitude !== null &&
    resolvedLongitude !== null &&
    resolvedLatitude >= -90 &&
    resolvedLatitude <= 90 &&
    resolvedLongitude >= -180 &&
    resolvedLongitude <= 180
  );
}

export function distanceFromLaunchCenterKm(latitude: unknown, longitude: unknown) {
  const resolvedLatitude = numberOrNull(latitude);
  const resolvedLongitude = numberOrNull(longitude);
  if (resolvedLatitude === null || resolvedLongitude === null) return null;
  if (resolvedLatitude < -90 || resolvedLatitude > 90 || resolvedLongitude < -180 || resolvedLongitude > 180) {
    return null;
  }

  const latitudeDelta = degreesToRadians(resolvedLatitude - launchMarket.center.latitude);
  const longitudeDelta = degreesToRadians(resolvedLongitude - launchMarket.center.longitude);
  const startLatitude = degreesToRadians(launchMarket.center.latitude);
  const endLatitude = degreesToRadians(resolvedLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function matchesLaunchCity(value: unknown) {
  return launchCityAliases.has(normalizeLocationName(value));
}

export function matchesLaunchState(value: unknown) {
  return launchStateAliases.has(normalizeLocationName(value));
}

export function isLaunchCity(value: unknown) {
  return !launchMarketRestricted || launchMarketIncludesAndhraPradesh || matchesLaunchCity(value);
}

export function isLaunchState(value: unknown) {
  return !launchMarketRestricted || matchesLaunchState(value) || (launchMarketIncludesAndhraPradesh && matchesAndhraPradeshState(value));
}

export function canonicalLaunchCity(value: unknown) {
  return matchesLaunchCity(value) ? launchMarket.city : null;
}

export function isInsideBengaluruLaunchArea(latitude: unknown, longitude: unknown) {
  const distanceKm = distanceFromLaunchCenterKm(latitude, longitude);
  return distanceKm !== null && distanceKm <= launchMarket.maximumBusinessDistanceKm;
}

export function isInsideLaunchMarket(latitude: unknown, longitude: unknown) {
  if (!validCoordinates(latitude, longitude)) return false;
  return !launchMarketRestricted || isInsideBengaluruLaunchArea(latitude, longitude) ||
    (launchMarketIncludesAndhraPradesh && isInsideAndhraPradeshPilotArea(latitude, longitude));
}

export type LaunchBusinessLocation = {
  city?: unknown;
  state?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export function isBengaluruOfferLocation(location: LaunchBusinessLocation) {
  return (
    matchesLaunchCity(location.city) &&
    matchesLaunchState(location.state) &&
    isInsideBengaluruLaunchArea(location.latitude, location.longitude)
  );
}

export function launchBusinessLocationError(
  location: LaunchBusinessLocation,
  options: { requireCoordinates?: boolean } = {}
) {
  if (launchMarketIncludesAndhraPradesh && matchesAndhraPradeshState(location.state)) {
    if (matchesLaunchCity(location.city)) return "Choose the correct state for the business city.";
    if (normalizeLocationName(location.city).length < 2) return "Enter the Andhra Pradesh business city.";
    const lat = numberOrNull(location.latitude);
    const lon = numberOrNull(location.longitude);
    if (lat === null || lon === null) return options.requireCoordinates ? "Pin the Andhra Pradesh business operating location on the map." : null;
    return isInsideAndhraPradeshPilotArea(lat, lon) ? null : "The business pin must match the Andhra Pradesh pilot location.";
  }
  if (launchMarketRestricted && !matchesLaunchCity(location.city)) {
    return `VyapaarMate is currently onboarding businesses only in ${launchMarket.displayName}.`;
  }
  if (launchMarketRestricted && !matchesLaunchState(location.state)) {
    return `The Bengaluru launch is currently limited to business locations in ${launchMarket.state}.`;
  }

  const latitude = numberOrNull(location.latitude);
  const longitude = numberOrNull(location.longitude);
  if (latitude === null || longitude === null) {
    return options.requireCoordinates
      ? launchMarketRestricted
        ? `Pin the operating location inside the ${launchMarket.displayName} launch area.`
        : "Pin the business operating location on the map."
      : null;
  }

  if (!validCoordinates(latitude, longitude)) {
    return "Choose a valid business operating location on the map.";
  }

  if (launchMarketRestricted && !isInsideBengaluruLaunchArea(latitude, longitude)) {
    return `The business pin must be within ${launchMarket.maximumBusinessDistanceKm} km of central Bengaluru for the current launch.`;
  }

  return null;
}

export function isEligibleLaunchBusinessLocation(
  location: LaunchBusinessLocation,
  options: { requireCoordinates?: boolean } = {}
) {
  return launchBusinessLocationError(location, options) === null;
}
