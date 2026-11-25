import { ArrowDown } from "lucide-react";
import { ContactPageContent } from "@/components/contact/contact-page";
import { PageHeroBanner, PublicPage } from "@/components/marketing/page-kit";
import { ButtonLink } from "@/components/ui/button";
import { createMetadata, jsonLd } from "@/lib/seo";
import { launchAreasServed, launchMarket, launchMarketRestricted } from "@/lib/launch-policy";
import { absoluteUrl, company } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";

const contactDescription =
  "Book a VyapaarMate pilot demo for direct website ordering, UPI payment tracking, WhatsApp updates, CRM, and local business workflows.";

export const metadata = createMetadata({
  title: "Contact",
  description: contactDescription,
  path: "/contact",
  keywords: ["VyapaarMate pilot demo", "Bengaluru and Andhra Pradesh business software", "PSHR INNOVEX PRIVATE LIMITED contact"]
});

function contactStructuredData() {
  const path = "/contact";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Contact", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    {
      ...webPageNode({
        path,
        name: "Contact PSHR INNOVEX PRIVATE LIMITED",
        description: contactDescription,
        breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
      }),
      "@type": "ContactPage"
    },
    breadcrumb,
    {
      "@type": "ContactPoint",
      "@id": `${absoluteUrl(path)}#support`,
      contactType: "sales and customer support",
      email: company.supportEmail,
      areaServed: launchAreasServed,
      availableLanguage: ["en", "hi"],
      ...(company.phone ? { telephone: company.phone } : {})
    }
  ]);
}

export default function ContactPage() {
  return (
    <>
      <script
        id="vyapaarmate-contact-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(contactStructuredData()) }}
      />
      <PublicPage>
        <PageHeroBanner
          eyebrow="Contact"
          eyebrowTone="violet"
          title="Book a VyapaarMate"
          highlight="demo"
          body={
            launchMarketRestricted
              ? `We are currently onboarding businesses in ${launchMarket.displayName}. Share your business type and workflow, and our team will contact you about your pilot cohort and setup.`
              : "Share your city, business type, and workflow, and our team will contact you about product availability and setup."
          }
          art="phone"
          sideArt={["shop", "calendar"]}
          actions={
            <>
              <ButtonLink href="#demo-request" size="lg" icon={<ArrowDown className="size-5" />} iconPosition="end">
                Request a demo
              </ButtonLink>
              <ButtonLink href="/demo" size="lg" variant="secondary">
                Try the live demo now
              </ButtonLink>
            </>
          }
        />
        <ContactPageContent />
      </PublicPage>
    </>
  );
}
