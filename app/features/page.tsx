import { ArrowRight, ShieldCheck } from "lucide-react";
import { CtaBand, FeatureRow, IconTile, PageHeroBanner, PublicPage, SectionTitle, type OrbTone } from "@/components/marketing/page-kit";
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
import { ButtonLink } from "@/components/ui/button";

const featuresDescription =
  "Explore VyapaarMate features for website ordering, bookings, UPI QR payments, WhatsApp updates, CRM, campaign drafts, staff roles, analytics, and admin controls.";

export const metadata = createMetadata({
  title: "Features",
  description: featuresDescription,
  path: "/features",
  keywords: ["VyapaarMate features", "WhatsApp customer updates", "UPI payment tracking", "business CRM"]
});

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

const controls = [
  "Role-based access for owner, manager, kitchen, service, and super admin.",
  "Tenant isolation through businessId checks on server-side APIs.",
  "Separate consent for WhatsApp confirmations, status updates, and marketing campaigns.",
  "Cashfree, WhatsApp Cloud API, email, SMS, and storage service layers.",
  "Audit logs for authentication, business setup, order, and admin actions.",
  "Secure headers, validation, rate limiting, and webhook verification."
];

const tileTones: OrbTone[] = ["peacock", "green", "ink", "kumkum", "marigold", "ink", "green", "peacock"];

export default function FeaturesPage() {
  const [catalog, whatsapp, payments, crm, reminders, dashboard, summary, staff] = featureCards;

  return (
    <>
      <script
        id="vyapaarmate-features-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(featuresStructuredData()) }}
      />
      <PublicPage>
        <PageHeroBanner
          eyebrow="Features"
          title="Everything your shop needs,"
          highlight="in one app"
          body="Orders, UPI payments, WhatsApp updates, customers and reports, working together."
          art="phone"
          sideArt={["upi", "bell"]}
          actions={
            <>
              <ButtonLink href="/demo" size="lg" icon={<ArrowRight className="size-5" />} iconPosition="end">
                Try the live demo
              </ButtonLink>
              <ButtonLink
                href="/register?plan=STARTER"
                size="lg"
                variant="secondary"
                data-marketing-event="cta_click"
                data-marketing-location="features_hero"
                data-marketing-label="submit_for_approval"
                data-marketing-destination="/register?plan=STARTER"
              >
                Register your shop
              </ButtonLink>
            </>
          }
        />

        <section className="mx-auto grid max-w-7xl gap-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <FeatureRow art="bowl" tint="marigold" eyebrow="Sell" title={catalog.title} body={catalog.body} points={["Food, products, services and classes", "Photos, prices and availability", "Your own shop link"]} />
          <FeatureRow art="upi" tint="peacock" eyebrow="Get paid" title={payments.title} body={payments.body} points={["Checkout on the order page", "Paid or pending at a glance", "Invoices customers can download"]} reverse />
          <FeatureRow art="phone" tint="green" eyebrow="Stay in touch" title={whatsapp.title} body={whatsapp.body} points={["Order confirmations", "Status changes as they happen", "Sent only with customer consent"]} />
          <FeatureRow art="customers" tint="kumkum" eyebrow="Grow" title={crm.title} body={crm.body} points={[reminders.body]} reverse />
          <FeatureRow art="chart" tint="ivory" eyebrow="Run it" title={dashboard.title} body={dashboard.body} points={[summary.body, staff.body]} />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="At a glance" title="All the features," highlight="side by side" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature, index) => (
              <IconTile key={feature.title} delay={index * 50} tone={tileTones[index % tileTones.length]} icon={<feature.icon className="size-5" />} title={feature.title} body={feature.body} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] vm-band p-6 text-white shadow-clay-lg sm:p-10">
            <div aria-hidden="true" className="vm-blob -right-16 -top-16 size-80 bg-brand opacity-25" />
            <div className="relative grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-green-200">Built in</p>
                <h2 className="mt-3 text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">Operational controls included in the MVP</h2>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {controls.map((item) => (
                  <li key={item} className="flex gap-3 rounded-[1.4rem] bg-white/10 p-4 text-sm font-semibold leading-6 text-white/85 ring-1 ring-white/10">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-green-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <CtaBand title="See it working in one minute." body="Order as a customer, pay with Demo UPI, then open the owner dashboard." art="rocket">
          <ButtonLink href="/demo" size="lg" variant="dark" icon={<ArrowRight className="size-5" />} iconPosition="end">
            Try the live demo
          </ButtonLink>
          <ButtonLink
            href="/register?plan=STARTER"
            size="lg"
            variant="secondary"
            data-marketing-event="cta_click"
            data-marketing-location="features_controls"
            data-marketing-label="submit_for_approval"
            data-marketing-destination="/register?plan=STARTER"
          >
            Submit for approval
          </ButtonLink>
        </CtaBand>
      </PublicPage>
    </>
  );
}
