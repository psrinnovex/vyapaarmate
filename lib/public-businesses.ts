import type { Prisma } from "@prisma/client";
import { calculateDistanceKm, fulfillmentModesFromFlags } from "@/lib/business-rules";
import { isBusinessAcceptingNow } from "@/lib/business-hours";
import { getBusinessLogoUrl } from "@/lib/business-image";
import { demoBusinesses, isDemoBusinessId, isDemoBusinessSlug, shouldExposePublicDemoBusinesses } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { initials } from "@/lib/utils";
import { canBusinessAcceptOnlinePayment, getOnlinePaymentConfig, type OnlinePaymentConfig } from "@/services/online-payments";

type ListingBusiness = Prisma.BusinessGetPayload<{
  include: {
    logoImage: { select: { updatedAt: true } };
    _count: { select: { menuItems: true } };
    menuItems: { select: { name: true; isBestSeller: true } };
  };
}>;

const featuredItemLimit = 3;

export type PublicBusinessListing = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  businessType: string;
  logoText: string;
  logoUrl: string | null;
  open: boolean;
  hours: string;
  minimumOrder: number;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  serviceRadiusKm: number;
  fulfillmentModes: string[];
  allowsPayOnDelivery: boolean;
  onlinePaymentAvailable: boolean;
  whatsappAvailable: boolean;
  itemCount: number;
  featuredItems: string[];
};

type ListingOptions = {
  latitude?: number | null;
  longitude?: number | null;
  query?: string | null;
};

function distanceFor(
  business: { latitude: number | null; longitude: number | null },
  options: ListingOptions
) {
  if (
    options.latitude === null ||
    options.longitude === null ||
    options.latitude === undefined ||
    options.longitude === undefined ||
    business.latitude === null ||
    business.longitude === null
  ) {
    return null;
  }

  return Math.round(
    calculateDistanceKm(
      { latitude: business.latitude, longitude: business.longitude },
      { latitude: options.latitude, longitude: options.longitude }
    ) * 10
  ) / 10;
}

function matchesQuery(business: PublicBusinessListing, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  return [
    business.name,
    business.city,
    business.state,
    business.businessType,
    business.address,
    business.featuredItems.join(" ")
  ].some((value) => value.toLowerCase().includes(term));
}

function hasViewerLocation(options: ListingOptions) {
  return (
    typeof options.latitude === "number" &&
    typeof options.longitude === "number" &&
    Number.isFinite(options.latitude) &&
    Number.isFinite(options.longitude)
  );
}

function isInsideOwnerRadius(business: PublicBusinessListing, options: ListingOptions) {
  if (business.serviceRadiusKm <= 0 || business.latitude === null || business.longitude === null) {
    return false;
  }

  if (!hasViewerLocation(options)) {
    return true;
  }

  return business.distanceKm !== null && business.distanceKm <= business.serviceRadiusKm;
}

function sortListings(a: PublicBusinessListing, b: PublicBusinessListing) {
  if (a.open !== b.open) return a.open ? -1 : 1;
  if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
  if (a.distanceKm !== null) return -1;
  if (b.distanceKm !== null) return 1;
  return a.name.localeCompare(b.name);
}

function isDemoFixtureBusiness(business: { id: string; slug: string }) {
  return isDemoBusinessId(business.id) || isDemoBusinessSlug(business.slug);
}

function mapDatabaseBusiness(business: ListingBusiness, options: ListingOptions, paymentConfig: OnlinePaymentConfig, now: Date): PublicBusinessListing {
  const latitude = business.latitude === null ? null : Number(business.latitude);
  const longitude = business.longitude === null ? null : Number(business.longitude);
  const manuallyOpen = business.isActive && business.isVerified && business.subscriptionStatus === "ACTIVE" && business.kycStatus === "APPROVED" && business.isOpen;

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    city: business.city,
    state: business.state,
    address: business.address,
    businessType: business.businessType,
    logoText: initials(business.name),
    logoUrl: getBusinessLogoUrl(business),
    open: isBusinessAcceptingNow({ manuallyOpen, hours: business.businessHours, now }),
    hours: business.businessHours,
    minimumOrder: Number(business.minimumOrder),
    latitude,
    longitude,
    distanceKm: distanceFor({ latitude, longitude }, options),
    serviceRadiusKm: Number(business.serviceRadiusKm),
    fulfillmentModes: fulfillmentModesFromFlags({
      businessType: business.businessType,
      acceptsPickup: business.acceptsPickup,
      acceptsDineIn: business.acceptsDineIn,
      acceptsServiceAtLocation: business.acceptsServiceAtLocation
    }),
    allowsPayOnDelivery: business.allowsPayLater,
    onlinePaymentAvailable: canBusinessAcceptOnlinePayment(business, paymentConfig),
    whatsappAvailable: Boolean(business.whatsappDisplayPhone && business.whatsappLiveEnabled),
    itemCount: business._count.menuItems,
    featuredItems: business.menuItems.map((item) => item.name).slice(0, featuredItemLimit)
  };
}

function mapDemoBusiness(business: (typeof demoBusinesses)[number], options: ListingOptions, now: Date): PublicBusinessListing {
  const featuredItems = business.menu
    .filter((item) => item.isBestSeller)
    .concat(business.menu)
    .map((item) => item.name)
    .filter((name, index, names) => names.indexOf(name) === index)
    .slice(0, featuredItemLimit);

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    city: business.city,
    state: business.state,
    address: business.address,
    businessType: business.businessType,
    logoText: business.logoText,
    logoUrl: business.logoUrl ?? null,
    open: isBusinessAcceptingNow({ manuallyOpen: business.isApproved && business.open, hours: business.hours, now }),
    hours: business.hours,
    minimumOrder: business.minimumOrder,
    latitude: business.latitude,
    longitude: business.longitude,
    distanceKm: distanceFor(business, options),
    serviceRadiusKm: business.serviceRadiusKm,
    fulfillmentModes: business.fulfillmentModes,
    allowsPayOnDelivery: business.allowsPayOnDelivery,
    onlinePaymentAvailable: business.onlinePaymentAvailable,
    whatsappAvailable: business.whatsappAvailable,
    itemCount: business.menu.length,
    featuredItems
  };
}

export async function getPublicBusinessListings(options: ListingOptions = {}) {
  const now = new Date();

  try {
    const [businesses, paymentConfig] = await Promise.all([
      prisma.business.findMany({
        where: {
          isActive: true,
          isVerified: true,
          subscriptionStatus: "ACTIVE",
          kycStatus: "APPROVED",
          isOpen: true,
          latitude: { not: null },
          longitude: { not: null },
          serviceRadiusKm: { gt: 0 }
        },
        orderBy: { name: "asc" },
        take: 240,
        include: {
          logoImage: { select: { updatedAt: true } },
          _count: { select: { menuItems: true } },
          menuItems: {
            orderBy: [{ isBestSeller: "desc" }, { updatedAt: "desc" }],
            take: featuredItemLimit,
            select: { name: true, isBestSeller: true }
          }
        }
      }),
      getOnlinePaymentConfig()
    ]);

    return businesses
      .map((business) => mapDatabaseBusiness(business, options, paymentConfig, now))
      .filter((business) => !isDemoFixtureBusiness(business))
      .filter((business) => business.open)
      .filter((business) => isInsideOwnerRadius(business, options))
      .filter((business) => matchesQuery(business, options.query ?? ""))
      .sort(sortListings);
  } catch {
    if (!shouldExposePublicDemoBusinesses()) return [];

    return demoBusinesses
      .filter((business) => business.isApproved)
      .map((business) => mapDemoBusiness(business, options, now))
      .filter((business) => business.open)
      .filter((business) => isInsideOwnerRadius(business, options))
      .filter((business) => matchesQuery(business, options.query ?? ""))
      .sort(sortListings);
  }
}
