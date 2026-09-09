export type PlatformRole =
  | "SUPER_ADMIN"
  | "SUPPORT_AGENT"
  | "OWNER"
  | "CUSTOMER"
  | "MANAGER"
  | "KITCHEN_STAFF"
  | "DELIVERY_STAFF";

export type InstallPlatform = "ios" | "android" | "macos" | "windows" | "chromeos" | "linux" | "other";

const backOfficeRoles = new Set<PlatformRole>(["SUPER_ADMIN", "SUPPORT_AGENT"]);
const mobileProductRoles = new Set<PlatformRole>([
  "CUSTOMER",
  "OWNER",
  "MANAGER",
  "KITCHEN_STAFF",
  "DELIVERY_STAFF"
]);
const knownRoles = new Set<PlatformRole>([...backOfficeRoles, ...mobileProductRoles]);

function isPathWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isBackOfficeRole(role: string | null | undefined): role is "SUPER_ADMIN" | "SUPPORT_AGENT" {
  return Boolean(role && backOfficeRoles.has(role as PlatformRole));
}

export function isPlatformRole(role: string | null | undefined): role is PlatformRole {
  return Boolean(role && knownRoles.has(role as PlatformRole));
}

export function isBackOfficeSurface(pathname: string, search = "") {
  if (isPathWithin(pathname, "/admin") || isPathWithin(pathname, "/support")) return true;

  const params = new URLSearchParams(search);
  const portal = params.get("type");
  if (portal === "admin" || portal === "support") return true;

  const nextPath = params.get("next");
  return Boolean(nextPath && (isPathWithin(nextPath, "/admin") || isPathWithin(nextPath, "/support")));
}

export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const normalized = userAgent.toLowerCase();
  const ipadDesktopMode = normalized.includes("macintosh") && maxTouchPoints > 1;

  if (ipadDesktopMode || /iphone|ipad|ipod/.test(normalized)) return "ios";
  if (normalized.includes("android")) return "android";
  if (normalized.includes("macintosh") || normalized.includes("mac os x")) return "macos";
  if (normalized.includes("windows")) return "windows";
  if (normalized.includes("cros")) return "chromeos";
  if (normalized.includes("linux")) return "linux";
  return "other";
}

export function isMobileInstallPlatform(platform: InstallPlatform) {
  return platform === "ios" || platform === "android";
}

export function canOfferInstalledApp({
  platform,
  role,
  pathname,
  search
}: {
  platform: InstallPlatform;
  role?: string | null;
  pathname: string;
  search?: string;
}) {
  if (!isPlatformRole(role)) return false;

  if (platform === "windows" || platform === "macos") return true;
  if (!isMobileInstallPlatform(platform)) return false;

  return mobileProductRoles.has(role) && !isBackOfficeSurface(pathname, search);
}

export function platformAccessForRole(role: PlatformRole) {
  const mobileInstalledApp = !isBackOfficeRole(role);

  return {
    website: true,
    iosInstalledApp: mobileInstalledApp,
    androidInstalledApp: mobileInstalledApp,
    windowsInstalledApp: true,
    macosInstalledApp: true
  } as const;
}
