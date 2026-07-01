import type { Metadata } from "next";
import { CheckCircle2, FileText, IndianRupee, Lightbulb, Target } from "lucide-react";
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
  "Grant-readiness summary for VyapaarMate Intelligence Engine, an AI-powered direct-commerce decision support system for Indian MSMEs.";

export const metadata: Metadata = createMetadata({
  title: "Grant Readiness",
  description,
  path: "/grant-readiness",
  keywords: ["VyapaarMate PRISM", "MSME grant readiness", "AI commerce decision support"]
});

const expectedOutcomes = [
  "Better demand planning",
  "Higher repeat customer engagement",
  "Lower missed payment follow-ups",
  "Improved owner decision-making",
  "Reduced dependence on large marketplaces",
  "Affordable digital intelligence for small businesses"
];

const useOfFunds = [
  "Intelligence engine development",
  "Data model and testing",
  "MSME pilot trials",
  "Product refinement",
  "Privacy/security hardening",
  "Patent/trademark/technical documentation if applicable",
  "Deployment and monitoring"
];

function structuredData() {
  const path = "/grant-readiness";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Grant Readiness", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "Grant Readiness",
      description,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb
  ]);
}

export default function GrantReadinessPage() {
  return (
    <>
      <script
        id="vyapaarmate-grant-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData()) }}
      />
      <main className="min-h-screen bg-white text-ink">
        <PublicHeader />
        <section className="border-b border-line bg-mist px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Badge variant="emerald">PRISM / grant readiness</Badge>
            <p className="mt-5 text-sm font-bold uppercase text-slate-500">Project Title</p>
            <h1 className="mt-2 max-w-5xl text-4xl font-extrabold leading-tight sm:text-5xl">
              VyapaarMate Intelligence Engine: AI-powered direct-commerce decision support system for Indian MSMEs
            </h1>
            <p className="mt-5 max-w-4xl text-base leading-7 text-slate-600">
              A practical, low-cost intelligence layer that turns local business activity into daily owner actions for
              demand planning, repeat engagement, payment follow-up, and direct-commerce operations.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/technology-innovation" icon={<FileText className="size-4" />}>
                Technology Narrative
              </ButtonLink>
              <ButtonLink href="/dashboard/ai-suggestions" variant="secondary">
                AI Suggestions
              </ButtonLink>
            </div>
          </div>
        </section>

        <Section eyebrow="Problem" title="Disconnected tools create missed MSME opportunities">
          <Card className="bg-white text-base leading-7 text-slate-700">
            Small Indian MSMEs often manage orders, payments, repeat customers, and customer reminders through
            disconnected tools like WhatsApp, notebooks, UPI screenshots, and manual memory. This creates missed repeat
            sales, poor demand planning, payment follow-up gaps, and low digital visibility.
          </Card>
        </Section>

        <Section eyebrow="Proposed innovation" title="From activity data to owner action" className="pt-0">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="bg-ink text-white">
              <Lightbulb className="size-8 text-emerald" />
              <h2 className="mt-4 text-xl font-bold">VyapaarMate Intelligence Engine</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">
                VyapaarMate Intelligence Engine converts local business activity data into simple, actionable
                recommendations for owners. It combines order analytics, repeat customer scoring, payment risk
                prioritisation, demand prediction, and business health scoring in one MSME-friendly dashboard.
              </p>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Order analytics",
                "Repeat customer scoring",
                "Payment risk priority",
                "Demand prediction",
                "Business health score",
                "Consent-aware campaign suggestions"
              ].map((item) => (
                <Card key={item} className="flex items-center gap-3 bg-mist">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald" />
                  <span className="font-bold text-ink">{item}</span>
                </Card>
              ))}
            </div>
          </div>
        </Section>

        <Section eyebrow="Expected outcome" title="Measurable owner value" className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {expectedOutcomes.map((outcome) => (
              <Card key={outcome} className="flex h-full gap-3 bg-white">
                <Target className="mt-0.5 size-5 shrink-0 text-ocean" />
                <p className="font-semibold leading-6 text-slate-700">{outcome}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section eyebrow="Use of funds" title="Focused development and pilot readiness" className="pt-0">
          <Card className="bg-mist">
            <div className="grid gap-3 md:grid-cols-2">
              {useOfFunds.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg bg-white p-4">
                  <IndianRupee className="mt-0.5 size-5 shrink-0 text-emerald" />
                  <p className="font-semibold leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>
        <PublicFooter />
      </main>
    </>
  );
}
