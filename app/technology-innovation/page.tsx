import type { Metadata } from "next";
import { ArrowRight, BrainCircuit, Database, LockKeyhole, MessageCircle, Quote, Rocket, Workflow } from "lucide-react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { CtaBand, PageHeroBanner, PublicPage, SectionTitle, StackCards } from "@/components/marketing/page-kit";
import { HorizontalScroll } from "@/components/motion/horizontal-scroll";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbListNode, graph, organizationNode, webPageNode, websiteNode } from "@/lib/structured-data";

const description =
  "VyapaarMate is developing a business-intelligence layer for Indian MSMEs that converts fragmented order, payment, customer, and booking data into actionable recommendations.";

export const metadata: Metadata = createMetadata({
  title: "Technology & Innovation",
  description,
  path: "/technology-innovation",
  keywords: ["VyapaarMate technology", "MSME intelligence engine", "MSME pilot development"]
});

const architectureSteps: { label: string; art: ClayIllustrationName }[] = [
  { label: "Customer Channel", art: "customers" },
  { label: "Website / WhatsApp", art: "phone" },
  { label: "Order & Booking Data", art: "bag" },
  { label: "Payment Data", art: "upi" },
  { label: "Customer History", art: "calendar" },
  { label: "VyapaarMate Intelligence Engine", art: "rocket" },
  { label: "Owner Dashboard", art: "chart" },
  { label: "Recommended Business Action", art: "success" }
];

const layers = [
  {
    title: "MSME Data Layer",
    body: "Collects tenant-scoped orders, bookings, catalog items, customer history, payment status, WhatsApp consent, and business settings.",
    icon: <Database className="size-5" />,
    art: "bag" as const,
    tint: "ocean" as const,
    tone: "ocean" as const
  },
  {
    title: "Intelligence Engine",
    body: "Runs low-cost rules, weighted moving averages, RFM scoring, payment priority formulas, and health-score calculations without mandatory paid AI calls.",
    icon: <BrainCircuit className="size-5" />,
    art: "chart" as const,
    tint: "violet" as const,
    tone: "violet" as const
  },
  {
    title: "Owner Action Layer",
    body: "Converts signals into plain actions such as prepare more stock, message opted-in customers, follow up payments, or promote top repeat items.",
    icon: <Workflow className="size-5" />,
    art: "bell" as const,
    tint: "emerald" as const,
    tone: "emerald" as const
  },
  {
    title: "Consent & Privacy Layer",
    body: "Keeps each business isolated by businessId and treats WhatsApp marketing consent separately from order-status communication.",
    icon: <LockKeyhole className="size-5" />,
    art: "shield" as const,
    tint: "berry" as const,
    tone: "berry" as const
  },
  {
    title: "Future ML Extension Layer",
    body: "Keeps the deterministic engine ML-ready so future prediction models or optional LLM summaries can be enabled behind feature flags.",
    icon: <Rocket className="size-5" />,
    art: "rocket" as const,
    tint: "mango" as const,
    tone: "mango" as const
  }
];

const pillars = ["Rules-based automation", "Machine-learning-ready models", "Consent-aware customer segmentation", "MSME-specific workflow intelligence"];

function structuredData() {
  const path = "/technology-innovation";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Technology & Innovation", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "Technology & Innovation",
      description,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb
  ]);
}

export default function TechnologyInnovationPage() {
  return (
    <>
      <script
        id="vyapaarmate-technology-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData()) }}
      />
      <PublicPage>
        <PageHeroBanner
          eyebrow="Product architecture and development"
          eyebrowTone="emerald"
          title="Technology &"
          highlight="Innovation"
          body="VyapaarMate is developing a business-intelligence layer for Indian MSMEs that converts fragmented order, payment, customer, and booking data into actionable recommendations."
          art="rocket"
          sideArt={["chart", "shield"]}
          actions={
            <>
              <ButtonLink href="/dashboard/ai-suggestions" size="lg" icon={<BrainCircuit className="size-5" />}>
                View AI Suggestions
              </ButtonLink>
              <ButtonLink href="/grant-readiness" size="lg" variant="secondary">
                Grant Readiness
              </ButtonLink>
            </>
          }
        >
          <ul className="mt-7 flex flex-wrap gap-2" aria-label="What the system combines">
            {pillars.map((pillar) => (
              <li key={pillar} className="glass rounded-full px-3.5 py-2 text-xs font-extrabold text-ink">
                {pillar}
              </li>
            ))}
          </ul>
        </PageHeroBanner>

        <HorizontalScroll
          className="py-10"
          header={
            <div className="mx-auto mb-8 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionTitle eyebrow="Architecture" title="How local commerce data becomes" highlight="an owner action" align="left" />
            </div>
          }
        >
          {architectureSteps.map((step, index) => (
            <div key={step.label} className="flex shrink-0 snap-start items-center gap-4">
              <article className={cn("clay flex h-[19rem] w-[15rem] flex-col rounded-[2rem] p-5 sm:w-[16.5rem]", index === 5 && "bg-clay-ink text-white shadow-clay-lg")}>
                <span className={cn("text-xs font-extrabold uppercase tracking-[0.12em]", index === 5 ? "text-emerald-200" : "text-slate-400")}>Step {index + 1}</span>
                <div className="grid flex-1 place-items-center">
                  <ClayIllustration name={step.art} className="h-32 w-32" />
                </div>
                <h3 className="text-lg font-extrabold leading-6 tracking-[-0.02em]">{step.label}</h3>
              </article>
              {index < architectureSteps.length - 1 && (
                <span aria-hidden="true" className="clay-orb size-10 shrink-0 rounded-full bg-white text-slate-400">
                  <ArrowRight className="size-4" />
                </span>
              )}
            </div>
          ))}
        </HorizontalScroll>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="System layers" title="Low-cost intelligence that fits" highlight="MSME operations" />
          <div className="mt-10">
            <StackCards items={layers} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="Pilot validation" title="Decisions owners can" highlight="explain and evaluate" />
          <div className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <ScrollReveal direction="right" className="h-full">
              <blockquote className="clay relative h-full rounded-[2rem] p-7 text-base font-medium leading-7 text-slate-700 sm:p-9">
                <span aria-hidden="true" className="absolute -top-5 left-7 grid size-12 place-items-center rounded-2xl bg-clay-violet text-white shadow-clay-sm">
                  <Quote className="size-5" />
                </span>
                The innovation is not only in digitising orders but in creating an MSME-specific decision engine that
                converts local-business activity into simple owner actions. Unlike generic e-commerce or CRM tools,
                VyapaarMate is designed around Indian local commerce behaviour where discovery, repeat orders,
                reminders, and customer communication often happen through WhatsApp, while payments and records need
                structured tracking.
              </blockquote>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={90} className="h-full">
              <div className="relative h-full overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#1d1a39_0%,#2b2160_60%,#3a2a8a_100%)] p-7 text-white shadow-clay-lg sm:p-9">
                <div aria-hidden="true" className="vm-blob -bottom-16 -right-16 size-64 bg-emerald opacity-25" />
                <span className="clay-orb relative size-12 rounded-2xl bg-clay-emerald text-white">
                  <MessageCircle className="size-6" />
                </span>
                <h2 className="relative mt-5 text-2xl font-extrabold tracking-[-0.03em]">Practical MSME intelligence</h2>
                <p className="relative mt-3 text-sm font-medium leading-6 text-white/75">
                  The first version uses deterministic calculations, data aggregation, and explainable templates. Optional
                  LLM integration can be added later for summaries, but the product works without OpenAI, Gemini, Claude,
                  or any paid AI provider.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <CtaBand title="See the suggestions on live demo data." body="Log in as the demo owner and open AI Suggestions." art="chart">
          <ButtonLink href="/demo" size="lg" variant="secondary" icon={<ArrowRight className="size-5" />} iconPosition="end">
            Open the live demo
          </ButtonLink>
        </CtaBand>
      </PublicPage>
    </>
  );
}
