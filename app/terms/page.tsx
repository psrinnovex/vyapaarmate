import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { pricingPlans, pricingPolicy } from "@/lib/constants";
import { subscriptionLaunchPlanAmounts } from "@/lib/billing";
import { launchMarket, launchMarketRestricted, launchOffer } from "@/lib/launch-policy";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { formatINR } from "@/lib/utils";
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
              {launchMarketRestricted
                ? `The current launch accepts eligible business locations in ${launchMarket.displayName} only. `
                : "Product availability is confirmed during onboarding. "}
              An application, payment, or account creation does not guarantee approval; VyapaarMate may verify location and business details.
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
              {launchOffer.enabled && (
                <li>
                  The automatic Bengaluru launch discount is 80% on each monthly subscription while the offer is enabled,
                  not only the first month. Starter is {formatINR(subscriptionLaunchPlanAmounts.STARTER)} and Pro is {formatINR(subscriptionLaunchPlanAmounts.PRO)},
                  plus GST. Their list prices remain {formatINR(pricingPlans[0].listPrice)} and {formatINR(pricingPlans[1].listPrice)}.
                  No coupon is required, and coupons do not stack with the launch discount.
                </li>
              )}
              <li>Each subscription payment covers a 30-day period. The owner reviews the current price, discount, GST, and total before creating each manual checkout. The launch offer may be disabled for future checkouts and does not lock a permanent renewal price.</li>
              <li>Businesses are responsible for product or service pricing, taxes, GST settings, fulfilment, refunds, cancellations, and customer communication.</li>
              <li>VyapaarMate provides software workflows and intelligence suggestions. It does not provide legal, tax, accounting, or financial advice.</li>
              <li>AI and rules-based suggestions are decision-support outputs, not guaranteed business outcomes.</li>
              <li>Businesses must verify recommendations before acting on stock planning, campaigns, payment follow-up, or customer messaging.</li>
              <li>Refunds and cancellations are governed by each business policy and the configured payment provider rules.</li>
              <li>A one-time setup fee, currently {pricingPolicy.setupFeeRange}, is separate from monthly subscription billing and depends on the agreed onboarding scope.</li>
              <li>GST, payment-gateway fees, WhatsApp message or template charges, and other provider usage costs are separate from subscription and setup fees.</li>
              <li>VyapaarMate may suspend access for misuse, non-payment, fraudulent activity, policy violations, or security risk.</li>
            </ul>
          </Card>
        </Section>
        <PublicFooter />
      </main>
    </>
  );
}
