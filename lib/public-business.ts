import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { fulfillmentModesFromFlags } from "@/lib/business-rules";
import {
  demoBusinesses,
  findDemoBusinessBySlug,
  isDemoBusinessId,
  isDemoBusinessSlug,
  type DemoBusiness,
  type DemoMenuItem
} from "@/lib/demo-data";
import { getBusinessLogoUrl } from "@/lib/business-image";
import { getMenuItemImageUrl } from "@/lib/menu-item-image";
import { prisma } from "@/lib/prisma";
import { orderGstRateBps } from "@/lib/billing";
import { initials } from "@/lib/utils";
import { canBusinessAcceptOnlinePayment, getOnlinePaymentConfig } from "@/services/online-payments";

type BusinessWithMenu = Prisma.BusinessGetPayload<{
  include: {
    logoImage: { select: { updatedAt: true } };
    menuItems: { include: { category: true; image: { select: { updatedAt: true } } } };
  };
}>;

export type PublicBusiness = DemoBusiness & {
  source: "database" | "demo";
  isDemo: boolean;
  canIndex: boolean;
};

function demoForBusiness(business: BusinessWithMenu) {
  return demoBusinesses.find((demo) => demo.id === business.id || demo.slug === business.slug);
}

function mapDemoBusiness(business: DemoBusiness): PublicBusiness {
  return {
    ...business,
    orderGstRateBps: orderGstRateBps(),
    source: "demo",
    isDemo: true,
    canIndex: false
  };
}

function mapMenuItem(item: BusinessWithMenu["menuItems"][number], demo?: DemoBusiness): DemoMenuItem {
  const demoItem = demo?.menu.find((candidate) => candidate.id === item.id || candidate.name === item.name);

  return {
    id: item.id,
    category: item.category.name,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    foodType: item.foodType,
    imageUrl: getMenuItemImageUrl(item) ?? demoItem?.imageUrl ?? null,
    isAvailable: item.isAvailable,
    isBestSeller: item.isBestSeller
  };
}

export const getPublicBusinessBySlug = cache(async (slug: string): Promise<PublicBusiness | null> => {
  const fallback = findDemoBusinessBySlug(slug);

  try {
    const businessQuery = prisma.business.findUnique({
      where: { slug },
      include: {
        logoImage: { select: { updatedAt: true } },
        menuItems: {
          orderBy: [{ category: { sortOrder: "asc" } }, { isBestSeller: "desc" }, { name: "asc" }],
          include: { category: true, image: { select: { updatedAt: true } } }
        }
      }
    });
    const paymentConfigQuery = fallback ? null : getOnlinePaymentConfig();
    const business = await businessQuery;

    if (!business) return fallback ? mapDemoBusiness(fallback) : null;

    const paymentConfig = paymentConfigQuery ? await paymentConfigQuery : await getOnlinePaymentConfig();

    const demo = demoForBusiness(business);
    const isDemo = isDemoBusinessId(business.id) || isDemoBusinessSlug(business.slug);
    const isApproved = business.isActive && business.isVerified && business.subscriptionStatus === "ACTIVE" && business.kycStatus === "APPROVED";

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      ownerName: business.ownerName,
      phone: business.phone,
      email: business.email,
      address: business.address,
      city: business.city,
      state: business.state,
      businessType: business.businessType,
      logoText: initials(business.name),
      logoUrl: getBusinessLogoUrl(business),
      isApproved,
      open: isApproved && business.isOpen,
      hours: business.businessHours,
      minimumOrder: Number(business.minimumOrder),
      deliveryFee: Number(business.deliveryFee),
      latitude: business.latitude === null ? null : Number(business.latitude),
      longitude: business.longitude === null ? null : Number(business.longitude),
      serviceRadiusKm: Number(business.serviceRadiusKm),
      fulfillmentModes: fulfillmentModesFromFlags({
        businessType: business.businessType,
        acceptsPickup: business.acceptsPickup,
        acceptsDineIn: business.acceptsDineIn,
        acceptsServiceAtLocation: business.acceptsServiceAtLocation
      }),
      allowsPayOnDelivery: business.allowsPayLater,
      onlinePaymentAvailable: canBusinessAcceptOnlinePayment(business, paymentConfig),
      whatsappAvailable: Boolean(business.whatsappDisplayPhone && business.whatsappConnected && business.whatsappLiveEnabled),
      orderGstRateBps: orderGstRateBps(),
      menu: business.menuItems.map((item) => mapMenuItem(item, demo)),
      source: "database",
      isDemo,
      canIndex: isApproved && !isDemo
    };
  } catch {
    return fallback ? mapDemoBusiness(fallback) : null;
  }
});
