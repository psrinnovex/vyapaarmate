import type { ReactNode } from "react";
import type { Icon } from "@/components/ui/iconsax";
import {
  ArrowRight,
  Activity,
  BoxTick,
  Card as CardIcon,
  Chart2,
  Cup,
  Global,
  MessageTick,
  Money,
  NotificationBing,
  People,
  Profile2User,
  ReceiptText,
  Scissor,
  ShieldTick,
  ShoppingBag,
  Shop,
  TaskSquare,
  TickCircle,
  WalletMoney
} from "@/components/ui/iconsax";
import HeroScene from "./hero-scene";
import { ScrollReveal } from "./scroll-reveal";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { businessServiceTypeOptions } from "@/lib/business-service-types";
import { featureCards, pricingPlans, pricingPolicy } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IntelligenceEngineSection } from "./intelligence-engine-section";

const navLinks = [
  { href: "#product", label: "Product" },
  { href: "#intelligence-engine", label: "Intelligence" },
  { href: "/technology-innovation", label: "Technology" },
  { href: "#businesses", label: "Business Types" },
  { href: "#subscriptions", label: "Pricing" },
  { href: "#faq", label: "FAQ" }
];

const heroStats = [
  { label: "business categories", value: `${businessServiceTypeOptions.length}` },
  { label: "platform commission", value: pricingPolicy.platformCommission },
  { label: "plans start at", value: formatINR(pricingPlans[0].price) }
];

const heroBadges = ["Website checkout", "WhatsApp updates", "Cashfree payments", "UPI QR", "CRM", "Staff roles"];

const operatingLoop = [
  {
    title: "Prepare the WhatsApp flow",
    body: "Set the business type, service area, fulfillment modes, catalog, availability, and consent settings.",
    Icon: Global,
    tone: "bg-ocean/10 text-ocean"
  },
  {
    title: "Let customers continue on WhatsApp",
    body: "Customers can start from WhatsApp, Instagram, Google Business Profile, QR posters, or repeat campaigns and finish the conversation in WhatsApp.",
    Icon: MessageTick,
    tone: "bg-emerald/10 text-emerald"
  },
  {
    title: "Run live operations",
    body: "Accept, prepare, complete, cancel, collect payment, and send customer updates from one dashboard.",
    Icon: TaskSquare,
    tone: "bg-violet/10 text-violet"
  },
  {
    title: "Grow repeat customers",
    body: "Use purchase history, opted-in reminders, top items, and daily reports to bring customers back directly.",
    Icon: People,
    tone: "bg-amber-100 text-amber-800"
  }
];

const businessGroups = [
  {
    title: "Food and beverage",
    examples: "Restaurants, tiffins, cloud kitchens, cafes, juice shops, sweets, catering",
    Icon: Cup
  },
  {
    title: "Retail essentials",
    examples: "Grocery, pharmacy, wellness, daily essentials, local product catalogs",
    Icon: ShoppingBag
  },
  {
    title: "Services and appointments",
    examples: "Salon, spa, laundry, tailoring, home services, repair, cleaning",
    Icon: Scissor
  },
  {
    title: "Local memberships",
    examples: "Fitness studios, yoga classes, subscriptions, repeat schedules",
    Icon: Activity
  }
];

const workflowViews = [
  ["Website checkout", "Customers place orders and complete UPI QR payment directly on the business website."],
  ["Owner dashboard", "Operations board for orders, bookings, payments, customers, campaigns, and reports."],
  ["Admin controls", "Approvals, verification, subscription status, support tickets, logs, and tenant-safe actions."]
];

const trustControls = [
  {
    title: "Business-type aware console",
    body: "Food businesses see menus and orders. Service businesses see services, bookings, clients, and service areas.",
    Icon: Shop
  },
  {
    title: "Consent-first messaging",
    body: "Order confirmations, status updates, payment-page reminders, and campaigns use separate WhatsApp consent paths.",
    Icon: ShieldTick
  },
  {
    title: "Payment-ready architecture",
    body: "UPI QR requests, subscription links, payment rows, refunds, and webhook confirmation are wired into the workflow.",
    Icon: WalletMoney
  },
  {
    title: "Automatic data refresh",
    body: "Owner and admin views are built around authenticated APIs and server-sent updates.",
    Icon: Chart2
  }
];

const publicFeatureIcons: Icon[] = [Cup, MessageTick, CardIcon, Profile2User, NotificationBing, Chart2, ReceiptText, ShieldTick];

const proofCards = [
  ["Tiffin center", "Keeps daily meal orders, customer reminders, and pending UPI payments in one workflow."],
  ["Salon and spa", "Turns WhatsApp appointment requests into trackable bookings with client history."],
  ["Grocery store", "Lets regular customers reorder essentials through WhatsApp without marketplace fees."]
];

const chargeRules = [
  ["Subscription", "Monthly SaaS access, dashboards, CRM, reports, staff roles, billing, and platform support."],
  ["Setup", "One-time onboarding based on catalog size, service areas, WhatsApp approval work, and payment configuration."],
  ["Usage", "Payment gateway fees and WhatsApp message/template charges stay separate as provider pass-through costs."]
];

export const faqItems = [
  [
    "Is VyapaarMate only for restaurants?",
    "No. The updated product supports food, retail, service, appointment, home-visit, and local membership businesses."
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
    "The app includes Cashfree, WhatsApp Cloud API, email, SMS, and storage-ready service layers so production credentials can be added during launch setup."
  ]
];

function LandingSection({
  id,
  eyebrow,
  title,
  body,
  className,
  children
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  body?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-7xl min-w-0 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <ScrollReveal className="mb-8 max-w-3xl min-w-0">
          {eyebrow && <p className="mb-3 text-sm font-bold text-emerald">{eyebrow}</p>}
          <h2 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{title}</h2>
          {body && <p className="mt-3 text-base leading-7 text-slate-600">{body}</p>}
        </ScrollReveal>
        {children}
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <main className="overflow-x-hidden bg-mist text-ink">
      <PublicHeader links={navLinks} />

      <section className="relative isolate overflow-hidden border-b border-line bg-[#eef4f8]">
        <HeroScene />
        <div className="absolute inset-y-0 left-0 z-[1] hidden w-full bg-[linear-gradient(90deg,#eef4f8_0%,rgba(238,244,248,0.98)_36%,rgba(238,244,248,0.72)_49%,rgba(238,244,248,0)_66%)] lg:block" />
        <div className="relative z-[2] mx-auto flex max-w-7xl min-w-0 items-center px-4 py-10 sm:px-6 sm:py-12 lg:min-h-[min(700px,calc(100svh-96px))] lg:px-8 lg:py-12">
          <ScrollReveal className="min-w-0 w-full max-w-[22rem] sm:max-w-[570px]" direction="right">
            <Badge className="max-w-full whitespace-normal text-left" variant="emerald">
              Direct commerce software for Indian local businesses
            </Badge>
            <h1 className="mt-4 max-w-full break-words text-[clamp(2rem,6.2vw,4rem)] font-extrabold leading-[0.96] text-ink">
              VyapaarMate
            </h1>
            <p className="mt-4 max-w-full text-base font-semibold leading-7 text-ink sm:max-w-[560px] sm:text-xl">
              Take website orders and bookings, collect payment, send WhatsApp updates, and run daily operations from one owner dashboard.
            </p>
            <p className="mt-3 max-w-full text-sm leading-6 text-slate-600 sm:max-w-[540px] sm:text-base sm:leading-7">
              Built for restaurants, tiffin centers, cloud kitchens, salons, grocery stores, home services, pharmacies, fitness studios, and local retailers that already sell through WhatsApp.
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <ButtonLink
                href="/register"
                className="w-full sm:w-auto"
                icon={<ArrowRight className="size-5" variant="Bold" />}
                data-marketing-event="cta_click"
                data-marketing-location="home_hero"
                data-marketing-label="submit_for_approval"
                data-marketing-destination="/register"
              >
                Submit for Approval
              </ButtonLink>
              <ButtonLink
                href="/features"
                className="w-full sm:w-auto"
                variant="secondary"
                icon={<BoxTick className="size-5" variant="Bulk" />}
                data-marketing-event="cta_click"
                data-marketing-location="home_hero"
                data-marketing-label="view_features"
                data-marketing-destination="/features"
              >
                View Features
              </ButtonLink>
            </div>
            <div className="mt-7 grid max-w-full grid-cols-3 gap-2 sm:max-w-[520px] sm:gap-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="min-w-0 overflow-hidden rounded-lg border border-line bg-white/85 px-3 py-3 shadow-sm backdrop-blur">
                  <p className="text-lg font-extrabold text-ink sm:text-xl">{stat.value}</p>
                  <p className="mt-1 break-words text-[11px] font-semibold leading-4 text-slate-600 sm:text-xs sm:leading-5">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex max-w-full flex-wrap gap-2 sm:max-w-[520px]">
              {heroBadges.map((badge) => (
                <span key={badge} className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 backdrop-blur">
                  {badge}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 md:grid-cols-[auto_1fr] md:items-center lg:px-8">
          <p className="text-sm font-bold text-slate-500">Built around the updated business-type system</p>
          <div className="flex min-w-0 flex-wrap gap-2 md:justify-end">
            {businessServiceTypeOptions.slice(0, 10).map((type) => (
              <span key={type.id} className="max-w-full rounded-full border border-line bg-mist px-3 py-1.5 text-xs font-bold text-slate-700">
                {type.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <LandingSection
        id="product"
        eyebrow="Product workflow"
        title="One operating system for direct local commerce"
        body="VyapaarMate connects website checkout, WhatsApp order updates, payment tracking, CRM, staff roles, and admin controls into a single flow."
        className="bg-mist"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {operatingLoop.map(({ title, body, Icon, tone }, index) => (
            <ScrollReveal key={title} className="h-full" delay={index * 70}>
              <Card className="h-full bg-white">
                <div className={`grid size-12 place-items-center rounded-lg ${tone}`}>
                  <Icon className="size-6" variant="Bulk" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {workflowViews.map(([title, body], index) => (
            <ScrollReveal key={title} delay={index * 80}>
              <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-ink">{title}</h3>
                  <span className="grid size-10 place-items-center rounded-lg bg-mist text-ocean">
                    {index === 0 && <Global className="size-5" variant="Bulk" />}
                    {index === 1 && <Chart2 className="size-5" variant="Bulk" />}
                    {index === 2 && <ShieldTick className="size-5" variant="Bulk" />}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </LandingSection>

      <IntelligenceEngineSection />

      <LandingSection
        id="businesses"
        eyebrow="Business coverage"
        title="Built for the categories already supported in the app"
        body="VyapaarMate adapts catalog labels, fulfillment modes, customer language, and dashboard copy for food, retail, appointment, service, and membership businesses."
        className="bg-white"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {businessGroups.map(({ title, examples, Icon }, index) => (
            <ScrollReveal key={title} className="h-full" delay={index * 70}>
              <Card className="h-full bg-mist">
                <div className="grid size-12 place-items-center rounded-lg bg-white text-ocean">
                  <Icon className="size-6" variant="Bulk" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{examples}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal className="mt-6">
          <div className="rounded-lg border border-line bg-ink p-5 text-white shadow-soft">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-bold text-emerald">Supported service types</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                  {businessServiceTypeOptions.map((type) => type.name).join(", ")}.
                </p>
              </div>
              <ButtonLink
                href="/register"
                variant="emerald"
                icon={<ArrowRight className="size-5" variant="Bold" />}
                data-marketing-event="cta_click"
                data-marketing-location="business_types"
                data-marketing-label="submit_your_business"
                data-marketing-destination="/register"
              >
                Submit Your Business
              </ButtonLink>
            </div>
          </div>
        </ScrollReveal>
      </LandingSection>

      <LandingSection
        eyebrow="Daily operations"
        title="Everything owners need after the customer messages"
        body="The product focuses on the real daily loop: taking the transaction, collecting money, updating the customer on WhatsApp, and knowing what to do next."
        className="bg-mist"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature, index) => (
            <ScrollReveal key={feature.title} className="h-full" delay={index * 55}>
              <Card className="h-full bg-white">
                <div className="grid size-12 place-items-center rounded-lg bg-ocean/10 text-ocean">
                  {(() => {
                    const FeatureIcon = publicFeatureIcons[index];
                    return FeatureIcon ? <FeatureIcon className="size-6" variant="Bulk" /> : <feature.icon className="size-6" />;
                  })()}
                </div>
                <h3 className="mt-4 font-bold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </LandingSection>

      <LandingSection
        eyebrow="Controls"
        title="Built with the operational details already in place"
        body="The updated system includes tenant-aware dashboards, live APIs, payment and messaging rows, consent controls, RBAC, audit logs, and production integration hooks."
        className="bg-white"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {trustControls.map(({ title, body, Icon }, index) => (
            <ScrollReveal key={title} delay={index * 70}>
              <div className="flex h-full gap-4 rounded-lg border border-line bg-mist p-5">
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-white text-emerald">
                  <Icon className="size-6" variant="Bulk" />
                </div>
                <div>
                  <h3 className="font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </LandingSection>

      <LandingSection
        id="subscriptions"
        eyebrow="Pricing"
        title="Charge a clear subscription, then keep setup and usage separate"
        body={`The recommended public pricing is Starter at ${formatINR(1499)}/month and Pro at ${formatINR(2999)}/month. This keeps entry affordable while protecting margin for support, payment workflows, WhatsApp setup, and admin review.`}
        className="bg-mist"
      >
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {pricingPlans.map((plan, index) => (
            <ScrollReveal key={plan.name} className="h-full" delay={index * 90}>
              <Card className="flex h-full flex-col bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-ink">{plan.name}</h3>
                    <p className="mt-2 min-h-14 text-sm leading-6 text-slate-600">{plan.description}</p>
                  </div>
                  {plan.name === "Pro" && <Badge variant="purple">Popular</Badge>}
                </div>
                <div className="mt-4 rounded-lg border border-line bg-mist p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">Best for</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">{plan.bestFor}</p>
                </div>
                <div className="mt-6">
                  <span className="text-4xl font-extrabold text-ink">{formatINR(plan.price)}</span>
                  <span className="text-slate-500">/month</span>
                  <p className="mt-1 text-xs font-bold uppercase text-slate-500">Monthly subscription</p>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-slate-700">
                      <TickCircle className="mt-0.5 size-5 shrink-0 text-emerald" variant="Bold" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 grid gap-2">
                  {plan.limits.map((limit) => (
                    <span key={limit} className="rounded-lg bg-mist px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                      {limit}
                    </span>
                  ))}
                </div>
                <ButtonLink
                  href="/register"
                  className="mt-6 w-full"
                  variant={plan.name === "Pro" ? "emerald" : "primary"}
                  data-marketing-event="cta_click"
                  data-marketing-location="home_pricing"
                  data-marketing-label={`register_${plan.id.toLowerCase()}`}
                  data-marketing-destination="/register"
                  data-marketing-value={plan.price}
                >
                  Register for {plan.name}
                </ButtonLink>
              </Card>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal className="mt-6">
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald/10 text-emerald">
                <Money className="size-6" variant="Bulk" />
              </div>
              <div>
                <h3 className="font-bold text-ink">One-time setup package</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {pricingPolicy.setupFeeRange} depending on catalog size, onboarding, WhatsApp templates, service areas, and payment integration scope.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {pricingPolicy.passThroughLabel} Annual plans can use a {pricingPolicy.annualDiscount} discount once renewals are stable.
                </p>
              </div>
            </div>
            <ButtonLink
              href="/contact"
              variant="secondary"
              data-marketing-event="cta_click"
              data-marketing-location="home_setup_package"
              data-marketing-label="talk_to_pshr_innovex"
              data-marketing-destination="/contact"
            >
              Contact PSHR INNOVEX
            </ButtonLink>
          </div>
        </ScrollReveal>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {chargeRules.map(([title, body], index) => (
            <ScrollReveal key={title} delay={index * 70}>
              <div className="h-full rounded-lg border border-line bg-white p-5 shadow-sm">
                <h3 className="font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </LandingSection>

      <LandingSection
        eyebrow="Proof points"
        title="Designed for the businesses that already run on WhatsApp"
        body="The product keeps familiar customer behavior while giving owners a structured system for tracking work and growing repeat sales."
        className="bg-white"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {proofCards.map(([name, quote], index) => (
            <ScrollReveal key={name} className="h-full" delay={index * 85}>
              <Card className="h-full bg-mist">
                <MessageTick className="size-7 text-violet" variant="Bulk" />
                <p className="mt-4 leading-7 text-slate-700">{quote}</p>
                <p className="mt-5 font-bold text-ink">{name}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="faq" eyebrow="FAQ" title="Clear answers before onboarding" className="bg-mist">
        <div className="grid gap-4 md:grid-cols-2">
          {faqItems.map(([question, answer], index) => (
            <ScrollReveal key={question} delay={index * 70}>
              <Card className="h-full bg-white">
                <h3 className="font-bold text-ink">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </LandingSection>

      <section className="bg-ink px-4 py-14 text-white sm:px-6 lg:px-8">
        <ScrollReveal className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold text-emerald">Ready for direct local commerce</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
              Launch website checkout, connect WhatsApp updates, then manage every order or booking from one dashboard.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <ButtonLink
              href="/register"
              size="lg"
              variant="emerald"
              icon={<ArrowRight className="size-6" variant="Bold" />}
              data-marketing-event="cta_click"
              data-marketing-location="home_final_cta"
              data-marketing-label="submit_for_approval"
              data-marketing-destination="/register"
            >
              Submit for Approval
            </ButtonLink>
            <ButtonLink
              href="/contact"
              size="lg"
              variant="secondary"
              icon={<MessageTick className="size-6" variant="Bulk" />}
              data-marketing-event="cta_click"
              data-marketing-location="home_final_cta"
              data-marketing-label="talk_to_pshr_innovex"
              data-marketing-destination="/contact"
            >
              Contact PSHR INNOVEX
            </ButtonLink>
            <ButtonLink
              href="/features"
              size="lg"
              variant="secondary"
              icon={<BoxTick className="size-6" variant="Bulk" />}
              data-marketing-event="cta_click"
              data-marketing-location="home_final_cta"
              data-marketing-label="view_features"
              data-marketing-destination="/features"
            >
              View Features
            </ButtonLink>
          </div>
        </ScrollReveal>
      </section>

      <PublicFooter />
    </main>
  );
}
