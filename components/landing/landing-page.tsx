import { ArrowRight, CalendarDays, Globe, MessageCircle, QrCode, ReceiptText, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import {
  CakeIllustration,
  GroceryIllustration,
  SalonIllustration,
  TiffinIllustration
} from "@/components/illustrations/clay-illustrations";
import { CountUp } from "@/components/motion/count-up";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { VelocityMarquee } from "@/components/motion/velocity-marquee";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { ButtonLink } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { businessServiceTypeOptions } from "@/lib/business-service-types";
import { pricingPlans } from "@/lib/constants";
import { launchMarket, launchMarketRestricted, launchOffer } from "@/lib/launch-policy";
import { formatINR } from "@/lib/utils";
import { BusinessTypes } from "./business-types";
import { FaqSection } from "./faq-section";
import { FeatureBento } from "./feature-bento";
import { FinalCta } from "./final-cta";
import { HeroStage } from "./hero-stage";
import { HowItWorks } from "./how-it-works";
import { IntelligenceEngineSection } from "./intelligence-engine-section";
import { PricingSection } from "./pricing-section";
import { ScrollReveal } from "./scroll-reveal";

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#product", label: "Features" },
  { href: "#intelligence-engine", label: "Intelligence" },
  { href: "#subscriptions", label: "Pricing" },
  { href: "#faq", label: "FAQ" }
];

const marqueeItems = [
  { label: "Own order page", Icon: Globe, tone: "bg-clay-green text-ink" },
  { label: "UPI QR", Icon: QrCode, tone: "bg-clay-peacock text-white" },
  { label: "WhatsApp updates", Icon: MessageCircle, tone: "bg-clay-green text-ink" },
  { label: "Bookings", Icon: CalendarDays, tone: "bg-clay-marigold text-ink" },
  { label: "Customer reminders", Icon: Users, tone: "bg-clay-kumkum text-white" },
  { label: "GST invoices", Icon: ReceiptText, tone: "bg-clay-ink text-white theme-dark" },
  { label: "Staff roles", Icon: ShieldCheck, tone: "bg-clay-ink text-white theme-dark" },
  { label: "Daily reports", Icon: TrendingUp, tone: "bg-clay-peacock text-white" }
];

const heroFaces = [
  { Art: TiffinIllustration, tint: "bg-marigold-50" },
  { Art: SalonIllustration, tint: "bg-ivory-100" },
  { Art: GroceryIllustration, tint: "bg-green-50" },
  { Art: CakeIllustration, tint: "bg-kumkum-50" }
];

export const faqItems = [
  [
    "Where is VyapaarMate currently available?",
    launchMarketRestricted
      ? `The current launch is limited to businesses in ${launchMarket.displayName}. We can expand to other cities later, but they are not part of this launch.`
      : `VyapaarMate is available to eligible businesses in ${launchMarket.country}.`
  ],
  [
    "How does the 80% Bengaluru launch discount work?",
    launchOffer.publiclyAdvertised
      ? `It applies automatically to every monthly subscription while the launch offer is enabled: Starter is ${formatINR(pricingPlans[0].price)} and Pro is ${formatINR(pricingPlans[1].price)}, each plus GST. It is not first-month-only, needs no coupon, and does not stack with coupons.`
      : `Starter is ${formatINR(pricingPlans[0].listPrice)} and Pro is ${formatINR(pricingPlans[1].listPrice)} per month, each plus GST.`
  ],
  [
    "Is VyapaarMate only for restaurants?",
    "No. The product supports food, retail and service workflows. The first pilot cohorts focus on food businesses so we can measure repeat use and support effort."
  ],
  [
    "Do customers need to use a website?",
    "Customers can start from WhatsApp or the website. Online UPI payments complete on the secure order page, and confirmations can still be sent on WhatsApp."
  ],
  [
    "Does it replace WhatsApp?",
    "No. WhatsApp stays the customer channel, while VyapaarMate becomes the structured owner system for orders, bookings, payments, and customer data."
  ],
  [
    "Are payments and provider integrations live?",
    "Payment, WhatsApp, and other provider connections depend on business approval, provider approval, production credentials, and setup. Their gateway or usage charges are separate."
  ]
];

export function LandingPage() {
  const starter = pricingPlans[0];
  return (
    <main className="overflow-x-clip text-ink">
      <ScrollProgress />
      <PublicHeader links={navLinks} />

      {/* ---------- Hero ---------- */}
      <section className="relative isolate">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:min-h-[min(760px,calc(100svh-5rem))] lg:grid-cols-[1.02fr_0.98fr] lg:gap-4 lg:px-8 lg:pb-20 lg:pt-4">
          <ScrollReveal className="min-w-0" direction="right">
            <Sticker
              tone="marigold"
              tilt={-2}
              className="max-w-[calc(100%-0.75rem)]"
              icon={
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full rounded-full bg-ink opacity-50 motion-safe:animate-ping theme-dark" />
                  <span className="relative inline-flex size-2 rounded-full bg-ink theme-dark" />
                </span>
              }
            >
              <span className="truncate">Now onboarding · {launchMarket.displayName}</span>
            </Sticker>
            <h1 className="mt-5">
              <span className="block font-display text-lg font-bold tracking-[-0.02em] text-ink sm:text-xl">
                Vyapaar<span className="text-green-700">Mate</span>
                <span className="sr-only"> (Vyapaar Mate)</span>
              </span>
              <span className="mt-2 block text-[clamp(2.7rem,7.4vw,5rem)] font-bold leading-[0.98] tracking-[-0.045em] text-ink">
                Take orders.
                <br />
                Get paid. <span className="vm-mark">Grow.</span>
              </span>
            </h1>
            <p className="mt-5 max-w-[28rem] text-base font-medium leading-7 text-ink-600 sm:text-lg">
              Your own shop link, UPI payments and WhatsApp updates in one simple app.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href="/demo"
                size="lg"
                icon={<ArrowRight className="size-5" />}
                iconPosition="end"
                data-marketing-event="cta_click"
                data-marketing-location="home_hero"
                data-marketing-label="try_demo"
                data-marketing-destination="/demo"
              >
                Try the live demo
              </ButtonLink>
              <ButtonLink
                href={`/register?plan=${starter.id}`}
                size="lg"
                variant="secondary"
                data-marketing-event="cta_click"
                data-marketing-location="home_hero"
                data-marketing-label="submit_for_approval"
                data-marketing-destination={`/register?plan=${starter.id}`}
              >
                Register your shop
              </ButtonLink>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-3">
                {heroFaces.map(({ Art, tint }, index) => (
                  <span key={index} className={`grid size-11 place-items-center rounded-full border-[3px] border-white shadow-clay-sm ${tint}`}>
                    <Art className="w-8" />
                  </span>
                ))}
              </div>
              <p className="text-sm font-bold leading-5 text-ink-500">
                Tiffins, salons, kirana
                <br />
                and {Math.max(0, businessServiceTypeOptions.length - 3)} more business types
              </p>
            </div>
          </ScrollReveal>
          <HeroStage />
        </div>
      </section>

      {/* ---------- Sticker strip (speeds up with scroll velocity) ---------- */}
      <div className="relative -rotate-[1.5deg] border-y-4 border-white bg-ink py-3 shadow-clay theme-dark">
        <VelocityMarquee>
          {marqueeItems.map(({ label, Icon, tone }) => (
            <span key={label} className="mx-2 inline-flex items-center gap-2.5 whitespace-nowrap px-2 text-sm font-extrabold text-white sm:text-base">
              <span className={`clay-orb size-8 rounded-xl ${tone}`}>
                <Icon className="size-4" />
              </span>
              {label}
              <Sparkles className="ml-3 size-4 text-marigold-400" />
            </span>
          ))}
        </VelocityMarquee>
      </div>

      <HowItWorks />

      <BusinessTypes />

      {/* ---------- Numbers ---------- */}
      <section aria-label="VyapaarMate at a glance" className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              value: <CountUp to={businessServiceTypeOptions.length} />,
              label: "business types supported",
              tone: "clay-tint-green"
            },
            {
              value: <CountUp to={Math.round(starter.price)} prefix="₹" />,
              label: launchOffer.publiclyAdvertised ? `a month to start, ${launchOffer.discountPercent}% off` : "a month to start, plus GST",
              tone: "clay-tint-peacock"
            },
            {
              value: <span>0</span>,
              label: "apps your customers need to install",
              tone: "clay-tint-marigold"
            }
          ].map(({ value, label, tone }, index) => (
            <ScrollReveal key={label} delay={index * 80}>
              <div className={`clay ${tone} flex items-center gap-4 rounded-[1.75rem] px-6 py-5`}>
                <span className="text-[2.6rem] font-extrabold leading-none tracking-[-0.05em] text-ink">{value}</span>
                <span className="text-sm font-bold leading-5 text-ink-500">{label}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <FeatureBento />

      <IntelligenceEngineSection />

      <PricingSection />

      <FaqSection items={faqItems} />

      <FinalCta />

      <PublicFooter />
    </main>
  );
}
