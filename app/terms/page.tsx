import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";

const termsDescription =
  "Read the VyapaarMate terms for direct ordering, customer management, payment workflows, WhatsApp communications, staff access, reporting, and integrations.";

export const metadata = createMetadata({
  title: "Terms of Service",
  description: termsDescription,
  path: "/terms",
  keywords: ["VyapaarMate terms", "PSHR INNOVEX PRIVATE LIMITED terms of service"]
});

function termsStructuredData() {
  const path = "/terms";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Terms of Service", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "VyapaarMate Terms of Service",
      description: termsDescription,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb
  ]);
}

export default function TermsPage() {
  return (
    <>
      <script
        id="vyapaarmate-terms-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(termsStructuredData()) }}
      />
      <main className="min-h-screen bg-white">
        <PublicHeader />
        <Section eyebrow="Terms" title="VyapaarMate Terms of Service">
          <Card className="prose max-w-none bg-mist text-slate-700">
            <p>
              VyapaarMate provides software for direct ordering, customer management, payment workflows, WhatsApp
              communications, staff access, reporting, and platform administration.
            </p>
            <p>
              Businesses are responsible for accurate menu information, pricing, GST/tax settings, order fulfilment,
              refund handling, customer consent, and compliance with applicable laws and messaging policies.
            </p>
            <p>
              Cashfree, UPI, WhatsApp Cloud API, email, SMS, and storage integrations must be configured with valid
              production credentials before live use.
            </p>
            <ul>
              <li>Businesses are responsible for product or service pricing, taxes, GST settings, fulfilment, refunds, cancellations, and customer communication.</li>
              <li>VyapaarMate provides software workflows and intelligence suggestions. It does not provide legal, tax, accounting, or financial advice.</li>
              <li>AI and rules-based suggestions are decision-support outputs, not guaranteed business outcomes.</li>
              <li>Businesses must verify recommendations before acting on stock planning, campaigns, payment follow-up, or customer messaging.</li>
              <li>Refunds and cancellations are governed by each business policy and the configured payment provider rules.</li>
              <li>Onboarding, setup, subscription billing, payment gateway charges, and WhatsApp message/template charges may be billed separately as communicated during setup.</li>
              <li>VyapaarMate may suspend access for misuse, non-payment, fraudulent activity, policy violations, or security risk.</li>
            </ul>
          </Card>
        </Section>
        <PublicFooter />
      </main>
    </>
  );
}
