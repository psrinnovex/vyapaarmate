import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerOrderPage } from "@/components/order/customer-order-page";
import { getSessionUser } from "@/lib/api-session";
import type { CustomerBookingProfile } from "@/lib/booking-profile";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import type { DemoBusiness } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { getPublicBusinessBySlug } from "@/lib/public-business";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { smsVerificationEnabled } from "@/services/sms";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusinessBySlug(slug);

  if (!business) {
    return createMetadata({
      title: "Business Not Found",
      description: "This VyapaarMate business page could not be found.",
      path: `/b/${slug}`,
      noIndex: true
    });
  }

  if (business.isDemo) {
    return createMetadata({
      title: "VyapaarMate Demo Store",
      description: "Preview the VyapaarMate demo ordering flow. This sample business is not a live merchant listing.",
      path: `/b/${business.slug}`,
      keywords: ["VyapaarMate demo store", "demo ordering flow"],
      noIndex: true
    });
  }

  const copy = getBusinessConsoleCopy(business.businessType);
  const location = [business.city, business.state].filter(Boolean).join(", ");

  return createMetadata({
    title: `${business.name} ${copy.catalogNavLabel}`,
    description: `View ${business.name} ${copy.catalogNavLabel.toLowerCase()} on VyapaarMate${location ? ` in ${location}` : ""}. Start ${copy.transactionPlural.toLowerCase()} through the website${business.whatsappAvailable ? " or WhatsApp" : ""}.`,
    path: `/b/${business.slug}`,
    keywords: [
      business.name,
      business.businessType,
      business.city,
      `${business.name} ${copy.catalogNavLabel}`,
      `${copy.transactionPlural} ${business.city}`
    ].filter(Boolean),
    noIndex: !business.canIndex
  });
}

function businessStructuredData(business: DemoBusiness) {
  const copy = getBusinessConsoleCopy(business.businessType);
  const businessUrl = absoluteUrl(`/b/${business.slug}`);
  const menuImage = business.menu.map((item) => item.imageUrl).find(Boolean);
  const resolveImage = (imageUrl: string | null) => {
    if (!imageUrl) return undefined;
    return imageUrl.startsWith("/") ? absoluteUrl(imageUrl) : imageUrl;
  };
  const paymentAccepted =
    [
      business.onlinePaymentAvailable ? "UPI" : null,
      business.onlinePaymentAvailable ? "online payment" : null,
      business.allowsPayOnDelivery ? "cash on delivery" : null
    ]
      .filter(Boolean)
      .join(", ") || "contact business";
  const images = Array.from(
    new Set(
      [business.logoUrl, menuImage, ...business.menu.slice(0, 6).map((item) => item.imageUrl)]
        .map((image) => resolveImage(image ?? null))
        .filter((image): image is string => Boolean(image))
    )
  );
  const businessDescription = `${business.name} offers ${copy.itemPlural.toLowerCase()} and ${copy.transactionPlural.toLowerCase()} through VyapaarMate.`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${businessUrl}#webpage`,
        url: businessUrl,
        name: `${business.name} ${copy.catalogNavLabel}`,
        description: businessDescription,
        inLanguage: siteConfig.language,
        isPartOf: {
          "@id": absoluteUrl("/#website")
        },
        primaryImageOfPage: images.length
          ? {
              "@type": "ImageObject",
              url: images[0]
            }
          : undefined,
        mainEntity: {
          "@id": `${businessUrl}#business`
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${businessUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Businesses", item: absoluteUrl("/businesses") },
          { "@type": "ListItem", position: 3, name: business.name, item: businessUrl }
        ]
      },
      {
        "@type": "LocalBusiness",
        "@id": `${businessUrl}#business`,
        name: business.name,
        url: businessUrl,
        image: images.length ? images : undefined,
        mainEntityOfPage: {
          "@id": `${businessUrl}#webpage`
        },
        telephone: business.phone,
        email: business.email,
        priceRange: "INR",
        paymentAccepted,
        currenciesAccepted: "INR",
        description: businessDescription,
        address: {
          "@type": "PostalAddress",
          streetAddress: business.address,
          addressLocality: business.city,
          addressRegion: business.state,
          addressCountry: "IN"
        },
        areaServed: {
          "@type": "AdministrativeArea",
          name: [business.city, business.state].filter(Boolean).join(", ")
        },
        geo:
          business.latitude !== null && business.longitude !== null
            ? {
                "@type": "GeoCoordinates",
                latitude: business.latitude,
                longitude: business.longitude
              }
            : undefined,
        openingHours: business.hours,
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: `${business.name} ${copy.catalogNavLabel}`,
          itemListElement: business.menu.slice(0, 12).map((item) => ({
            "@type": "Offer",
            price: item.price,
            priceCurrency: "INR",
            availability: item.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemOffered: {
              "@type": "Product",
              name: item.name,
              description: item.description,
              image: resolveImage(item.imageUrl)
            }
          }))
        }
      }
    ]
  };
}

async function getCustomerBookingProfile(slug: string): Promise<CustomerBookingProfile> {
  const nextPath = `/b/${slug}`;
  const loginHref = `/login?type=user&next=${encodeURIComponent(nextPath)}`;
  const registerHref = `/register?type=user&next=${encodeURIComponent(nextPath)}`;
  const profileHref = "/user/profile";
  const session = await getSessionUser();

  if (!session) {
    return { status: "guest", loginHref, registerHref, profileHref, name: "", email: "", phone: "" };
  }

  if (session.role !== "CUSTOMER") {
    return { status: "wrong_role", loginHref, registerHref, profileHref, name: "", email: "", phone: "" };
  }

  const user = await prisma.user.findFirst({
    where: { id: session.id, role: "CUSTOMER" },
    select: {
      name: true,
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true
    }
  });

  if (!user) {
    return { status: "guest", loginHref, registerHref, profileHref, name: "", email: "", phone: "" };
  }

  const status = user.emailVerifiedAt && (!smsVerificationEnabled() || user.phoneVerifiedAt) ? "verified" : "unverified";

  return {
    status,
    loginHref,
    registerHref,
    profileHref,
    name: user.name,
    email: user.email,
    phone: user.phone ?? ""
  };
}

export default async function BusinessOrderRoute({ params }: PageProps) {
  const { slug } = await params;
  const [business, bookingProfile] = await Promise.all([
    getPublicBusinessBySlug(slug),
    getCustomerBookingProfile(slug)
  ]);

  if (!business) notFound();

  return (
    <>
      {business.canIndex && (
        <script
          id={`vyapaarmate-business-${business.slug}-structured-data`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(businessStructuredData(business)) }}
        />
      )}
      <CustomerOrderPage business={business} bookingProfile={bookingProfile} />
    </>
  );
}
