import { absoluteUrl, company, siteConfig } from "@/lib/site";

type BreadcrumbInput = {
  name: string;
  path: string;
};

type WebPageInput = {
  path: string;
  name: string;
  description: string;
  breadcrumbId?: string;
};

type ItemListInput = {
  id: string;
  name: string;
  items: Array<{
    name: string;
    description?: string;
    url?: string;
  }>;
};

export const organizationId = absoluteUrl("/#organization");
export const websiteId = absoluteUrl("/#website");

export function organizationNode() {
  const contactPoint = {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: company.supportEmail,
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
    ...(company.phone ? { telephone: company.phone } : {})
  };

  return {
    "@type": "Organization",
    "@id": organizationId,
    name: company.name,
    url: absoluteUrl("/"),
    email: company.supportEmail,
    ...(company.phone ? { telephone: company.phone } : {}),
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN"
    },
    brand: {
      "@type": "Brand",
      name: siteConfig.name
    },
    logo: absoluteUrl("/icon.svg"),
    image: absoluteUrl("/opengraph-image"),
    contactPoint
  };
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    inLanguage: siteConfig.language,
    publisher: {
      "@id": organizationId
    }
  };
}

export function breadcrumbListNode(items: BreadcrumbInput[], idPath = items.at(-1)?.path ?? "/") {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(idPath)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

export function webPageNode({ path, name, description, breadcrumbId }: WebPageInput) {
  const pageUrl = absoluteUrl(path);

  return {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name,
    description,
    inLanguage: siteConfig.language,
    isPartOf: {
      "@id": websiteId
    },
    publisher: {
      "@id": organizationId
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl("/opengraph-image")
    },
    breadcrumb: breadcrumbId
      ? {
          "@id": breadcrumbId
        }
      : undefined
  };
}

export function itemListNode({ id, name, items }: ItemListInput) {
  return {
    "@type": "ItemList",
    "@id": id,
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.url,
      item: {
        "@type": "Thing",
        name: item.name,
        description: item.description
      }
    }))
  };
}

export function graph(nodes: unknown[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes
  };
}
