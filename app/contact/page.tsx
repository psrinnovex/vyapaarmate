import { ContactPageContent } from "@/components/contact/contact-page";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { createMetadata, jsonLd } from "@/lib/seo";
import { launchAreasServed } from "@/lib/launch-policy";
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
      <main className="min-h-screen bg-mesh-light">
        <PublicHeader />
        <ContactPageContent />
        <PublicFooter />
      </main>
    </>
  );
}
