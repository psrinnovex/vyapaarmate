import { LandingPage, faqItems } from "@/components/landing/landing-page";
import { pricingPlans } from "@/lib/constants";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  organizationId,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";

export const metadata = createMetadata({ path: "/" });

function homeStructuredData() {
  const softwareId = absoluteUrl("/#software");
  const breadcrumbId = `${absoluteUrl("/")}#breadcrumb`;

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path: "/",
      name: siteConfig.title,
      description: siteConfig.description,
      breadcrumbId
    }),
    breadcrumbListNode([{ name: "Home", path: "/" }], "/"),
    {
      "@type": "SoftwareApplication",
      "@id": softwareId,
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Local commerce, WhatsApp CRM, UPI payment management",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description: siteConfig.description,
      featureList: [
        "Website orders and bookings",
        "UPI QR payment tracking",
        "WhatsApp customer updates",
        "CRM and customer reminders",
        "Campaigns",
        "Owner dashboards"
      ],
      keywords: siteConfig.keywords.join(", "),
      publisher: {
        "@id": organizationId
      },
      areaServed: {
        "@type": "Country",
        name: "India"
      },
      offers: pricingPlans.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: String(plan.price),
        priceCurrency: "INR",
        category: "subscription"
      }))
    },
    {
      "@type": "FAQPage",
      "@id": absoluteUrl("/#faq"),
      mainEntity: faqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer
        }
      }))
    }
  ]);
}

export default function HomePage() {
  return (
    <>
      <script
        id="vyapaarmate-home-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeStructuredData()) }}
      />
      <LandingPage />
    </>
  );
}
