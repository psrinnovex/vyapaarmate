import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/site";

const defaultImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${siteConfig.name} direct local commerce dashboard`
};

const indexRobots = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1
  }
} satisfies Metadata["robots"];

const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false
  }
} satisfies Metadata["robots"];

type SeoMetadataInput = {
  title?: string;
  description?: string;
  path?: string | null;
  keywords?: string[];
  noIndex?: boolean;
};

function fullTitle(title?: string) {
  return title ? `${title} | ${siteConfig.name}` : siteConfig.title;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function envToken(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return undefined;
}

export function getSearchVerification(): Metadata["verification"] | undefined {
  const other: Record<string, string> = {};
  const bing = envToken("BING_SITE_VERIFICATION", "NEXT_PUBLIC_BING_SITE_VERIFICATION");

  if (bing) other["msvalidate.01"] = bing;

  const verification: Metadata["verification"] = {
    google: envToken("GOOGLE_SITE_VERIFICATION", "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"),
    yandex: envToken("YANDEX_SITE_VERIFICATION", "NEXT_PUBLIC_YANDEX_SITE_VERIFICATION"),
    yahoo: envToken("YAHOO_SITE_VERIFICATION", "NEXT_PUBLIC_YAHOO_SITE_VERIFICATION"),
    other: Object.keys(other).length ? other : undefined
  };

  return Object.values(verification).some(Boolean) ? verification : undefined;
}

export function createMetadata({
  title,
  description = siteConfig.description,
  path = "/",
  keywords = [],
  noIndex = false
}: SeoMetadataInput = {}): Metadata {
  const canonicalPath = path === null ? null : path.startsWith("/") ? path : `/${path}`;
  const resolvedTitle = fullTitle(title);

  return {
    title,
    description,
    keywords: unique([...siteConfig.keywords, ...keywords]),
    alternates: canonicalPath
      ? {
          canonical: canonicalPath,
          languages: {
            [siteConfig.language]: canonicalPath,
            "x-default": canonicalPath
          }
        }
      : undefined,
    openGraph: {
      type: "website",
      url: absoluteUrl(canonicalPath ?? "/"),
      siteName: siteConfig.name,
      title: resolvedTitle,
      description,
      locale: siteConfig.locale,
      images: [defaultImage]
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [defaultImage.url]
    },
    robots: noIndex ? noIndexRobots : indexRobots
  };
}

export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export { defaultImage, indexRobots, noIndexRobots };
