import { ContactPageContent } from "@/components/contact/contact-page";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl, company } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";

const contactDescription =
  "Contact PSHR INNOVEX PRIVATE LIMITED to book a VyapaarMate demo for direct website ordering, UPI QR payment tracking, WhatsApp updates, CRM, and local business workflows.";

export const metadata = createMetadata({
  title: "Contact",
  description: contactDescription,
  path: "/contact",
  keywords: ["VyapaarMate demo", "PSHR INNOVEX PRIVATE LIMITED contact", "book business software demo"]
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
      areaServed: "IN",
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
