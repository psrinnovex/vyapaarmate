import { Money, TickCircle } from "@/components/ui/iconsax";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { pricingPlans, pricingPolicy } from "@/lib/constants";
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
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const pricingDescription =
  "Compare VyapaarMate Starter and Pro subscription plans for Indian local businesses that need direct ordering, UPI QR payments, CRM, campaigns, and WhatsApp updates.";

export const metadata = createMetadata({
  title: "Pricing",
  description: pricingDescription,
  path: "/pricing",
  keywords: ["VyapaarMate pricing", "small business software pricing India", "WhatsApp ordering pricing", "restaurant software pricing"]
});

function pricingStructuredData() {
  const path = "/pricing";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Pricing", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "VyapaarMate Pricing",
      description: pricingDescription,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb,
    {
      "@type": "Product",
      "@id": `${absoluteUrl(path)}#subscriptions`,
      name: `${siteConfig.name} subscriptions`,
      description: pricingDescription,
      brand: {
        "@type": "Brand",
        name: siteConfig.name
      },
      category: "Business software",
      manufacturer: {
        "@id": organizationId
      },
      offers: pricingPlans.map((plan) => ({
        "@type": "Offer",
        name: `${siteConfig.name} ${plan.name}`,
        url: `${absoluteUrl(path)}#${plan.id.toLowerCase()}`,
        price: String(plan.price),
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        category: "subscription",
        eligibleRegion: {
          "@type": "Country",
          name: "India"
        }
      }))
    }
  ]);
}

export default function PricingPage() {
  return (
    <>
      <script
        id="vyapaarmate-pricing-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(pricingStructuredData()) }}
      />
      <main className="min-h-screen overflow-x-hidden bg-mesh-light">
        <PublicHeader />
        <Section
          eyebrow="Pricing"
          title="Plans built around real local-business margins"
          body="Keep subscription simple, charge setup separately, and pass payment or WhatsApp usage costs through transparently."
        >
        <div className="mx-auto grid max-w-5xl min-w-0 gap-5 md:grid-cols-2">
          {pricingPlans.map((plan, index) => (
            <ScrollReveal key={plan.name} className="h-full w-[calc(100vw-2rem)] min-w-0 md:w-auto" delay={index * 90}>
              <Card className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white/90">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold text-ink">{plan.name}</h2>
                  {plan.name === "Pro" && <Badge variant="purple">Recommended</Badge>}
                </div>
                <p className="mt-3 min-h-16 break-words text-sm leading-6 text-slate-600">{plan.description}</p>
                <div className="mt-4 rounded-lg bg-mist p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Best for</p>
                  <p className="mt-1 break-words text-sm font-semibold leading-6 text-ink">{plan.bestFor}</p>
                </div>
                <p className="mt-6 break-words text-4xl font-extrabold text-ink">
                  {formatINR(plan.price)}
                  <span className="text-base font-medium text-slate-500">/month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex min-w-0 gap-2 text-sm text-slate-700">
                      <TickCircle className="mt-0.5 size-5 shrink-0 text-emerald" variant="Bold" />
                      <span className="min-w-0 break-words">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 grid gap-2">
                  {plan.limits.map((limit) => (
                    <span key={limit} className="min-w-0 break-words rounded-lg bg-mist px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                      {limit}
                    </span>
                  ))}
                </div>
                <ButtonLink
                  href="/register"
                  className="mt-6 w-full"
                  variant={plan.name === "Pro" ? "emerald" : "primary"}
                  data-marketing-event="cta_click"
                  data-marketing-location="pricing_plan"
                  data-marketing-label={`register_${plan.id.toLowerCase()}`}
                  data-marketing-destination="/register"
                  data-marketing-value={plan.price}
                >
                  Submit for Approval
                </ButtonLink>
              </Card>
            </ScrollReveal>
          ))}
        </div>
        <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-3">
          {[
            ["Subscription", `Starter at ${formatINR(1499)}/month and Pro at ${formatINR(2999)}/month cover SaaS access, dashboards, support, and platform operations.`],
            ["Setup", `${pricingPolicy.setupFeeRange} one time for catalog import, service areas, WhatsApp templates, payment setup, and launch support.`],
            ["Usage", pricingPolicy.passThroughLabel]
          ].map(([title, body], index) => (
            <ScrollReveal key={title} className="w-[calc(100vw-2rem)] min-w-0 md:w-auto" delay={index * 70}>
              <Card className="h-full w-full min-w-0 overflow-hidden bg-white/90">
                <h2 className="font-bold text-ink">{title}</h2>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">{body}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal className="mt-6 w-[calc(100vw-2rem)] sm:w-auto">
          <Card className="flex min-w-0 flex-col gap-4 overflow-hidden bg-ink text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/10">
                <Money className="size-6" variant="Bulk" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold">Simple break-even check</h3>
                <p className="mt-1 break-words text-sm leading-6 text-white/70">
                  At a {formatINR(250)} average order value, six direct orders cover Starter and twelve cover Pro. At a {formatINR(600)} service booking value, three direct bookings cover Starter and five cover Pro.
                </p>
              </div>
            </div>
            <ButtonLink
              href="/contact"
              variant="secondary"
              data-marketing-event="cta_click"
              data-marketing-location="pricing_break_even"
              data-marketing-label="talk_to_pshr_innovex"
              data-marketing-destination="/contact"
            >
              Contact PSHR INNOVEX
            </ButtonLink>
          </Card>
        </ScrollReveal>
        </Section>
        <PublicFooter />
      </main>
    </>
  );
}
