export const company = {
  product: "VyapaarMate",
  name: "PSHR INNOVEX PRIVATE LIMITED",
  supportEmail: "support@pshrinnovex.com",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE?.trim() || null,
  address: "India"
};

const fallbackOrigin = "https://vyapaarmate.com";

export const siteConfig = {
  name: company.product,
  companyName: company.name,
  title: "VyapaarMate | WhatsApp Commerce, UPI Payments and CRM for Local Businesses",
  description:
    "VyapaarMate helps Indian local businesses take direct orders and bookings, collect UPI payments, send WhatsApp updates, manage CRM, campaigns, and dashboards.",
  shortDescription:
    "Website orders and bookings, UPI QR payments, WhatsApp updates, CRM, campaigns, and owner dashboards for Indian local businesses.",
  locale: "en_IN",
  themeColor: "#0f172a",
  market: "India",
  language: "en-IN",
  keywords: [
    "VyapaarMate",
    "PSHR INNOVEX PRIVATE LIMITED",
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
