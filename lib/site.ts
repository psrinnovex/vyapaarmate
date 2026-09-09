import { launchMarket, launchMarketRestricted } from "@/lib/launch-policy";

export const company = {
  product: "VyapaarMate",
  name: "PSHR INNOVEX PRIVATE LIMITED",
  supportEmail: "support@pshrinnovex.com",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE?.trim() || null,
  address: "India"
};

const fallbackOrigin = "https://www.vyapaarmate.com";

export const siteConfig = {
  name: company.product,
  companyName: company.name,
  title: launchMarketRestricted
    ? `VyapaarMate ${launchMarket.displayName} | WhatsApp Commerce, UPI Payments and CRM`
    : "VyapaarMate | WhatsApp Commerce, UPI Payments and CRM for Local Businesses",
  description:
    launchMarketRestricted
      ? `VyapaarMate is currently onboarding local businesses in ${launchMarket.displayName} for direct orders and bookings, UPI payments, WhatsApp updates, CRM, campaigns, and dashboards.`
      : "VyapaarMate helps Indian local businesses take direct orders and bookings, collect UPI payments, send WhatsApp updates, manage CRM, campaigns, and dashboards.",
  shortDescription:
    launchMarketRestricted
      ? `Website orders and bookings, UPI QR payments, WhatsApp updates, CRM, campaigns, and owner dashboards for businesses in ${launchMarket.displayName}.`
      : "Website orders and bookings, UPI QR payments, WhatsApp updates, CRM, campaigns, and owner dashboards for Indian local businesses.",
  locale: "en_IN",
  themeColor: "#0f172a",
  market: launchMarketRestricted ? launchMarket.displayName : launchMarket.country,
  language: "en-IN",
  alternateNames: ["Vyapaar Mate", "vyapaarmate", "vyapaar mate"] as readonly string[],
  keywords: [
    "VyapaarMate",
    "Vyapaar Mate",
    "PSHR INNOVEX PRIVATE LIMITED",
    "Bengaluru business software",
    "Bangalore business software",
    "Bengaluru WhatsApp ordering software",
    "Indian small business software",
    "local business software India",
    "website ordering system",
    "WhatsApp ordering software",
    "WhatsApp business CRM",
    "UPI QR payments",
    "direct ordering platform",
    "online booking software India",
    "restaurant ordering software India",
    "tiffin order management",
    "cloud kitchen ordering software",
    "salon booking software India",
    "grocery ordering software India",
    "pharmacy ordering software India",
    "home services booking software",
    "local business CRM",
    "customer reminders",
    "owner dashboard",
    "business campaigns"
  ]
} as const;

function normalizeOrigin(value: string | undefined) {
  if (!value) return fallbackOrigin;

  try {
    return new URL(value).origin;
  } catch {
    return fallbackOrigin;
  }
}

export function getSiteOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteOrigin()).toString();
}
