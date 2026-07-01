import {
  ArrowRight,
  Card as CardIcon,
  Chart2,
  Cup,
  MessageTick,
  NotificationBing,
  Profile2User,
  ReceiptText,
  ShieldTick,
  TickCircle
} from "@/components/ui/iconsax";
import type { Icon } from "@/components/ui/iconsax";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { featureCards } from "@/lib/constants";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  itemListNode,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";

const featuresDescription =
  "Explore VyapaarMate features for website ordering, bookings, UPI QR payments, WhatsApp updates, CRM, campaigns, staff roles, analytics, and admin controls.";

export const metadata = createMetadata({
  title: "Features",
  description: featuresDescription,
  path: "/features",
  keywords: ["VyapaarMate features", "WhatsApp customer updates", "UPI payment tracking", "business CRM"]
});

const featurePageIcons: Icon[] = [Cup, MessageTick, CardIcon, Profile2User, NotificationBing, Chart2, ReceiptText, ShieldTick];

function featuresStructuredData() {
  const path = "/features";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Features", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "VyapaarMate Features",
      description: featuresDescription,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb,
    itemListNode({
      id: `${absoluteUrl(path)}#feature-list`,
      name: "VyapaarMate feature list",
      items: featureCards.map((feature) => ({
        name: feature.title,
        description: feature.body
      }))
    })
  ]);
}

export default function FeaturesPage() {
  return (
    <>
      <script
        id="vyapaarmate-features-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(featuresStructuredData()) }}
      />
      <main className="min-h-screen bg-mist">
        <PublicHeader />
        <Section
          eyebrow="Features"
          title="A complete website commerce and WhatsApp updates platform for local businesses"
          body="VyapaarMate combines ordering, payments, WhatsApp customer flow, CRM, campaigns, staff roles, analytics, and admin controls in one clean product."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature, index) => (
              <ScrollReveal key={feature.title} className="h-full" delay={index * 55}>
                <Card className="h-full bg-white">
                  {(() => {
                    const FeatureIcon = featurePageIcons[index];
                    return FeatureIcon ? <FeatureIcon className="size-8 text-ocean" variant="Bulk" /> : <feature.icon className="size-8 text-ocean" />;
                  })()}
                  <h2 className="mt-4 font-bold text-ink">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </Section>
        <Section title="Operational controls included in the MVP" className="bg-white">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Role-based access for owner, manager, kitchen, service, and super admin.",
              "Tenant isolation through businessId checks on server-side APIs.",
              "Separate consent for WhatsApp confirmations, status updates, and marketing campaigns.",
              "Cashfree, WhatsApp Cloud API, email, SMS, and storage service layers.",
              "Audit logs for authentication, business setup, order, and admin actions.",
              "Secure headers, validation, rate limiting, and webhook verification."
            ].map((item) => (
              <ScrollReveal key={item} className="h-full">
                <div className="flex h-full gap-3 rounded-lg border border-line bg-mist p-4">
                  <TickCircle className="mt-0.5 size-6 shrink-0 text-emerald" variant="Bold" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ButtonLink
            href="/register"
            className="mt-8"
            icon={<ArrowRight className="size-5" variant="Bold" />}
            data-marketing-event="cta_click"
            data-marketing-location="features_controls"
            data-marketing-label="submit_for_approval"
            data-marketing-destination="/register"
          >
            Submit for Approval
          </ButtonLink>
        </Section>
        <PublicFooter />
      </main>
    </>
  );
}
