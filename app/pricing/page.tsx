import { ArrowRight, Calculator } from "lucide-react";
import { ClayIllustration } from "@/components/illustrations/clay-illustrations";
import { PlanCards } from "@/components/landing/pricing-section";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { BreakEvenCalculator } from "@/components/marketing/break-even-calculator";
import { CtaBand, PageHeroBanner, PublicPage, SectionTitle, tintClass } from "@/components/marketing/page-kit";
import { Sticker } from "@/components/ui/sticker";
import { pricingPlans, pricingPolicy } from "@/lib/constants";
import { launchAreasServed, launchMarket, launchMarketRestricted, launchOffer } from "@/lib/launch-policy";
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
import { cn, formatINR } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";

const pricingDescription = launchMarketRestricted
  ? `Compare VyapaarMate Starter and Pro monthly plans for businesses currently onboarding in ${launchMarket.displayName}, with any location-specific promotion confirmed at checkout.`
  : "Compare VyapaarMate Starter and Pro monthly plans for local businesses that need direct ordering, UPI QR payments, CRM, campaigns, and WhatsApp updates.";

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
        name: siteConfig.name,
        alternateName: siteConfig.alternateNames
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
        eligibleRegion: launchAreasServed
      }))
    }
  ]);
}

export default function PricingPage() {
  const costs = [
    {
      title: "Subscription",
      art: "upi" as const,
      tint: "peacock" as const,
      body: launchOffer.publiclyAdvertised
        ? `Starter is ${formatINR(pricingPlans[0].price)}/month and Pro is ${formatINR(pricingPlans[1].price)}/month during the enabled launch offer; list prices remain ${formatINR(pricingPlans[0].listPrice)} and ${formatINR(pricingPlans[1].listPrice)}. GST is additional.`
        : `Starter is ${formatINR(pricingPlans[0].listPrice)}/month and Pro is ${formatINR(pricingPlans[1].listPrice)}/month, plus GST.`
    },
    {
      title: "Setup",
      art: "rocket" as const,
      tint: "marigold" as const,
      body: `${pricingPolicy.setupFeeRange} one time for catalog import, service areas, WhatsApp templates, payment setup, and launch support. It is separate from the subscription.`
    },
    {
      title: "Usage",
      art: "phone" as const,
      tint: "green" as const,
      body: "Payment-gateway fees, WhatsApp charges, and any other provider usage costs are billed separately from the subscription and setup fee."
    }
  ];

  return (
    <>
      <script
        id="vyapaarmate-pricing-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(pricingStructuredData()) }}
      />
      <PublicPage>
        <PageHeroBanner
          eyebrow={launchMarketRestricted ? `${launchMarket.displayName} pilot pricing` : "Pricing"}
          title={launchOffer.publiclyAdvertised ? `${launchOffer.discountPercent}% off` : "Plans built around"}
          highlight={launchOffer.publiclyAdvertised ? "every monthly subscription" : "real shop margins"}
          body={
            launchOffer.publiclyAdvertised
              ? `The ${launchMarket.displayName} launch price applies automatically while the offer is enabled. It is not a first-month-only discount and no coupon is required.`
              : "Keep subscription simple, charge setup separately, and pass payment or WhatsApp usage costs through transparently."
          }
          art="upi"
          sideArt={["bag", "success"]}
        />

        {launchOffer.publiclyAdvertised && (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="glass flex flex-col gap-3 rounded-[1.75rem] p-5 sm:flex-row sm:items-center sm:gap-5">
                <Sticker tone="green" tilt={-4}>
                  {launchOffer.discountPercent}% {launchMarket.city} launch discount
                </Sticker>
                <p className="text-sm font-semibold leading-6 text-ink-600">
                  Applied automatically to every monthly subscription while enabled. Coupons do not stack with this offer. Standard list prices stay at {formatINR(pricingPlans[0].listPrice)} for Starter and {formatINR(pricingPlans[1].listPrice)} for Pro. GST, one-time setup, payment-gateway fees, WhatsApp charges, and other provider usage are separate.
                </p>
              </div>
            </ScrollReveal>
          </div>
        )}

        <section aria-label="Plans" className="px-4 py-12 sm:px-6 lg:px-8">
          <PlanCards detailed location="pricing_plan" />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="What you pay" title="Three simple parts," highlight="nothing hidden" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {costs.map((cost, index) => (
              <ScrollReveal key={cost.title} delay={index * 80} className="h-full">
                <article className="clay flex h-full flex-col overflow-hidden rounded-[2rem]">
                  <div className={cn("grid h-36 place-items-center", tintClass[cost.tint])}>
                    <ClayIllustration name={cost.art} className="h-28 w-28" />
                  </div>
                  <div className="p-6">
                    <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">{cost.title}</h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-ink-600">{cost.body}</p>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="relative overflow-hidden rounded-[2.5rem] vm-band p-6 text-white shadow-clay-lg sm:p-10">
              <div aria-hidden="true" className="vm-blob -left-20 -top-24 size-80 bg-marigold-400 opacity-30" />
              <div className="relative grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div>
                  <span className="clay-orb size-14 rounded-2xl bg-clay-green text-ink">
                    <Calculator className="size-6" />
                  </span>
                  <h2 className="mt-5 text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">Simple break-even check</h2>
                  <p className="mt-3 max-w-md text-sm font-medium leading-6 text-white/70">
                    Compare the monthly software fee with your contribution margin from direct orders or bookings. Setup, GST, gateway charges, WhatsApp usage, and other provider costs should be included separately in your own calculation.
                  </p>
                  <ButtonLink
                    href="/contact"
                    variant="secondary"
                    className="mt-6"
                    data-marketing-event="cta_click"
                    data-marketing-location="pricing_break_even"
                    data-marketing-label="talk_to_pshr_innovex"
                    data-marketing-destination="/contact"
                  >
                    Contact PSHR INNOVEX
                  </ButtonLink>
                </div>
                <BreakEvenCalculator />
              </div>
            </div>
          </ScrollReveal>
        </section>

        <CtaBand title="Try it before you pay." body="Run a full order and Demo UPI payment in the live demo." art="upi">
          <ButtonLink href="/demo" size="lg" variant="dark" icon={<ArrowRight className="size-5" />} iconPosition="end">
            Try the live demo
          </ButtonLink>
        </CtaBand>
      </PublicPage>
    </>
  );
}
