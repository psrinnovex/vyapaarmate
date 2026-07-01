import type { Metadata } from "next";
import { ArrowRight, BrainCircuit, Database, LockKeyhole, MessageCircle, Rocket, ShieldCheck, Workflow } from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { createMetadata, jsonLd } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbListNode, graph, organizationNode, webPageNode, websiteNode } from "@/lib/structured-data";

const description =
  "VyapaarMate is developing a business-intelligence layer for Indian MSMEs that converts fragmented order, payment, customer, and booking data into actionable recommendations.";

export const metadata: Metadata = createMetadata({
  title: "Technology & Innovation",
  description,
  path: "/technology-innovation",
  keywords: ["VyapaarMate technology", "MSME intelligence engine", "PRISM ready startup innovation"]
});

const architectureSteps = [
  "Customer Channel",
  "Website / WhatsApp",
  "Order & Booking Data",
  "Payment Data",
  "Customer History",
  "VyapaarMate Intelligence Engine",
  "Owner Dashboard",
  "Recommended Business Action"
];

const layers = [
  {
    title: "MSME Data Layer",
    body: "Collects tenant-scoped orders, bookings, catalog items, customer history, payment status, WhatsApp consent, and business settings.",
    Icon: Database
  },
  {
    title: "Intelligence Engine",
    body: "Runs low-cost rules, weighted moving averages, RFM scoring, payment priority formulas, and health-score calculations without mandatory paid AI calls.",
    Icon: BrainCircuit
  },
  {
    title: "Owner Action Layer",
    body: "Converts signals into plain actions such as prepare more stock, message opted-in customers, follow up payments, or promote top repeat items.",
    Icon: Workflow
  },
  {
    title: "Consent & Privacy Layer",
    body: "Keeps each business isolated by businessId and treats WhatsApp marketing consent separately from order-status communication.",
    Icon: LockKeyhole
  },
  {
    title: "Future ML Extension Layer",
    body: "Keeps the deterministic engine ML-ready so future prediction models or optional LLM summaries can be enabled behind feature flags.",
    Icon: Rocket
  }
];

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
      <main className="min-h-screen bg-mist text-ink">
        <PublicHeader />
        <section className="border-b border-line bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Badge variant="emerald" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              PRISM-ready innovation narrative
            </Badge>
            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl">Technology & Innovation</h1>
            <p className="mt-5 max-w-4xl text-base leading-7 text-slate-600 sm:text-lg">
              VyapaarMate is developing a business-intelligence layer for Indian MSMEs that converts fragmented order,
              payment, customer, and booking data into actionable recommendations. The system combines rules-based
              automation, machine-learning-ready models, consent-aware customer segmentation, and MSME-specific workflow
              intelligence to help small businesses run direct commerce without depending only on marketplaces.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/dashboard/ai-suggestions" icon={<BrainCircuit className="size-4" />}>
                View AI Suggestions
              </ButtonLink>
              <ButtonLink href="/grant-readiness" variant="secondary">
                Grant Readiness
              </ButtonLink>
            </div>
          </div>
        </section>

        <Section eyebrow="Architecture" title="How local commerce data becomes an owner action">
          <Card className="overflow-hidden bg-white">
            <div className="grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))] xl:grid-cols-[repeat(8,minmax(0,1fr))]">
              {architectureSteps.map((step, index) => (
                <div key={step} className="flex min-w-0 items-center gap-3">
                  <div className="flex min-h-24 flex-1 items-center justify-center rounded-lg border border-line bg-mist p-3 text-center text-sm font-bold leading-5 text-ink">
                    {step}
                  </div>
                  {index < architectureSteps.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-slate-400 xl:block" />}
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section eyebrow="System layers" title="Low-cost intelligence that fits MSME operations" className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {layers.map(({ title, body, Icon }) => (
              <Card key={title} className="h-full bg-white">
                <div className="grid size-12 place-items-center rounded-lg bg-ocean/10 text-ocean">
                  <Icon className="size-6" />
                </div>
                <h2 className="mt-5 font-bold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section eyebrow="PRISM-ready explanation" title="Innovation beyond digitising orders" className="pt-0">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="bg-white text-base leading-7 text-slate-700">
              <p>
                The innovation is not only in digitising orders but in creating an MSME-specific decision engine that
                converts local-business activity into simple owner actions. Unlike generic e-commerce or CRM tools,
                VyapaarMate is designed around Indian local commerce behaviour where discovery, repeat orders,
                reminders, and customer communication often happen through WhatsApp, while payments and records need
                structured tracking.
              </p>
            </Card>
            <Card className="bg-ink text-white">
              <MessageCircle className="size-7 text-emerald" />
              <h2 className="mt-4 text-xl font-bold">Practical MSME intelligence</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">
                The first version uses deterministic calculations, data aggregation, and explainable templates. Optional
                LLM integration can be added later for summaries, but the product works without OpenAI, Gemini, Claude,
                or any paid AI provider.
              </p>
            </Card>
          </div>
        </Section>
        <PublicFooter />
      </main>
    </>
  );
}
