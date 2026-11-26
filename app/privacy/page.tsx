import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { PageHeroBanner, PublicPage } from "@/components/marketing/page-kit";
import { launchMarket, launchMarketRestricted } from "@/lib/launch-policy";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl, company } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";

const privacyDescription =
  "Read the VyapaarMate privacy policy for tenant-isolated business data, customer records, WhatsApp consent, provider credentials, and security practices.";

export const metadata = createMetadata({
  title: "Privacy Policy",
  description: privacyDescription,
  path: "/privacy",
  keywords: ["VyapaarMate privacy policy", "PSHR INNOVEX PRIVATE LIMITED privacy"]
});

function privacyStructuredData() {
  const path = "/privacy";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Privacy Policy", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "VyapaarMate Privacy Policy",
      description: privacyDescription,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb
  ]);
}

export default function PrivacyPage() {
  const sections: LegalSection[] = [
    {
      id: "your-data",
      title: "Your business data stays yours",
      body: (
        <p>
          VyapaarMate is built for tenant-isolated business data. Business owners can access only their own orders,
          menu, customers, payments, campaigns, staff, and reports. PSHR Innovex super admins can access platform
          analytics and business records for support, billing, verification, and security operations.
        </p>
      )
    },
    {
      id: "customer-consent",
      title: "Customer details and consent",
      body: (
        <p>
          Customer phone numbers, addresses, order history, WhatsApp update consent, and marketing consent are stored
          separately. Marketing campaigns must only be sent to customers who have opted in to offers.
        </p>
      )
    },
    {
      id: "how-we-use-data",
      title: "How data is used",
      body: (
        <p>
          Payment status, order data, booking data, catalog data, and customer history are used to operate the
          software and generate business insights for the relevant business owner. VyapaarMate does not sell customer
          data.
        </p>
      )
    },
    {
      id: "location",
      title: "Location and service areas",
      body: (
        <p>
          Business address, map coordinates, and service-area information may be used to
          {launchMarketRestricted ? ` check ${launchMarket.displayName} launch eligibility,` : " confirm product availability,"}{" "}
          configure fulfilment, prevent misuse, and support onboarding.
        </p>
      )
    },
    {
      id: "safeguards",
      title: "Safeguards and your requests",
      body: (
        <ul>
          <li>Business and customer records are isolated by business tenant.</li>
          <li>Customer phone numbers and order history are stored per business.</li>
          <li>WhatsApp customer communication should follow customer consent and applicable messaging policies.</li>
          <li>Payment status and order data are used only for workflow, reporting, and business intelligence suggestions.</li>
          <li>Support chatbot messages and support tickets may be retained as needed to answer requests, prevent abuse, and maintain an operational record.</li>
          <li>Configured payment, messaging, email, and storage providers receive only the data needed for their part of the requested workflow.</li>
          <li>Businesses and users can request export, correction, or deletion support by emailing {company.supportEmail}. Some records may need to be retained for security, billing, disputes, or applicable legal obligations.</li>
          <li>Production deployments must use HTTPS, secure environment variables, webhook verification, and encrypted provider secrets where applicable.</li>
          <li>Sensitive owner, admin, payment, KYC, and support actions should be audit logged for review and abuse prevention.</li>
        </ul>
      )
    }
  ];

  return (
    <>
      <script
        id="vyapaarmate-privacy-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(privacyStructuredData()) }}
      />
      <PublicPage>
        <PageHeroBanner
          eyebrow="Privacy"
          eyebrowTone="green"
          title="VyapaarMate"
          highlight="Privacy Policy"
          body="How business and customer data is kept separate, used and protected."
          art="shield"
          sideArt={["customers", "bell"]}
        />
        <LegalDocument sections={sections} />
      </PublicPage>
    </>
  );
}
