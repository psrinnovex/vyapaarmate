import type { MetadataRoute } from "next";
import { getPublicBusinessListings } from "@/lib/public-businesses";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const revalidate = 3600;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

const staticRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/register", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" }
] as const;

function sitemapImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;

  try {
    return new URL(imageUrl).toString();
  } catch {
    return absoluteUrl(imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`);
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const defaultImage = absoluteUrl("/opengraph-image");
  const liveBusinesses = isProductionBuild ? [] : await getPublicBusinessListings();
  const businessSlugs = new Set(liveBusinesses.map((business) => business.slug));
  const businessImages = new Map(
    liveBusinesses.map((business) => [business.slug, sitemapImage(business.logoUrl)])
  );

  return [
    ...staticRoutes.map((route) => {
      const url = absoluteUrl(route.path);
      return {
        url,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            [siteConfig.language]: url,
            "x-default": url
          }
        },
        images: [defaultImage]
      };
    }),
    ...Array.from(businessSlugs).map((slug) => {
      const url = absoluteUrl(`/b/${slug}`);
      const image = businessImages.get(slug);
      return {
        url,
        lastModified,
        changeFrequency: "daily" as const,
        priority: 0.7,
        alternates: {
          languages: {
            [siteConfig.language]: url,
            "x-default": url
          }
        },
        images: image ? [image] : [defaultImage]
      };
    })
  ];
}
