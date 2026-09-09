import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ClipboardList, MapPin, Target } from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { createMetadata } from "@/lib/seo";

const description = "VyapaarMate incubation and pilot plan: direct orders, payment status and customer follow-up, with separate Bengaluru and Andhra Pradesh cohorts.";
export const metadata: Metadata = createMetadata({ title: "Incubation and Pilot Plan", description, path: "/grant-readiness" });

const workflow = [
  ["Receive", "A customer places a direct order or booking through the business catalog."],
  ["Operate", "The owner and authorised staff track fulfilment and payment status in one workspace."],
  ["Follow up", "Customer records and permitted updates support service and repeat visits."],
  ["Learn", "Explainable rules highlight actions. The pilot measures whether they help the owner."]
];
const milestones = [
  { period: "Days 1–30", title: "Understand the merchant", target: "20 owner interviews", body: "Recruit across the two cohorts, choose one initial food-business segment in each, and rehearse the complete demo.", evidence: "Dated interview notes, workflow baseline and agreed pilot scope." },
  { period: "Days 31–60", title: "Observe real operations", target: "5 consenting pilot businesses", body: "Record onboarding effort and observe order handling. Report each cohort separately; the five-business target is across both cohorts.", evidence: "Weekly usage, support effort, consent records and merchant feedback." },
  { period: "Days 61–90", title: "Review willingness to pay", target: "Review repeat use", body: "Compare paid conversion, continued use and service costs. Decide whether to improve, extend or pause each cohort.", evidence: "Usage trends, paid subscription records and a decision on the next cohort." }
];

export default function GrantReadinessPage() {
  return (
    <main className="min-h-screen bg-white text-ink">
      <PublicHeader />
      <section className="border-b border-line bg-[#10261d] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Badge variant="emerald">PSHR INNOVEX PRIVATE LIMITED</Badge>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl">A focused merchant pilot with measurable outcomes</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/80">VyapaarMate brings direct orders, payment status and customer follow-up into one workspace. Our incubation plan is to test that workflow with local food businesses and use the evidence to improve the product and subscription model.</p>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-white/65">Proposed incubation work. The targets below are not completed interviews, customers, revenue, funding or confirmation of admission to any programme.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/b/fresh-bowl-cloud-kitchen" variant="emerald" icon={<ArrowRight className="size-4" />}>Explore the demo catalog</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">Discuss a pilot or product review</ButtonLink>
          </div>
        </div>
      </section>
      <Section eyebrow="Core product" title="One connected operating workflow">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflow.map(([title, body], index) => <Card key={title}><span className="text-sm font-bold text-emerald">0{index + 1}</span><h2 className="mt-3 text-xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{body}</p></Card>)}
        </div>
        <p className="mt-5 max-w-4xl text-sm leading-6 text-slate-600">Catalogs, orders, booking tools, staff roles and decision-support modules are implemented in the product. Payment-provider confirmation and WhatsApp delivery depend on configured services and must be verified for a live pilot. Recommendation accuracy remains a validation task.</p>
      </Section>
      <Section eyebrow="Market entry" title="Two cohorts with separate evidence" className="bg-mist">
        <div className="grid gap-5 md:grid-cols-2">
          <Card><MapPin className="size-6 text-emerald" /><h2 className="mt-4 text-xl font-bold">Bengaluru</h2><p className="mt-3 leading-7 text-slate-600">Build on local outreach to food businesses. Measure onboarding, weekly use and willingness to pay within this cohort.</p><p className="mt-4 text-sm leading-6 text-slate-500">Any Bengaluru launch discount applies only to eligible Bengaluru businesses and is confirmed at checkout.</p></Card>
          <Card><MapPin className="size-6 text-emerald" /><h2 className="mt-4 text-xl font-bold">Andhra Pradesh</h2><p className="mt-3 leading-7 text-slate-600">Seek introductions through RTIH for a separate cohort of tiffin centres and small restaurants. Start from the founder’s Kadapa and Tirupati connections.</p><p className="mt-4 text-sm leading-6 text-slate-500">Confirm the local segment, merchant consent and pilot terms before onboarding. Track this cohort separately from Bengaluru.</p></Card>
        </div>
      </Section>
      <Section eyebrow="Proposed first 90 days" title="Turn a working demo into useful merchant evidence">
        <div className="grid gap-5 lg:grid-cols-3">
          {milestones.map(item => <Card key={item.period}><p className="text-sm font-bold text-emerald">{item.period}</p><h2 className="mt-3 text-xl font-bold">{item.title}</h2><p className="mt-4 text-lg font-bold">{item.target}</p><p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p><p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-600"><span className="font-bold text-ink">Evidence to review: </span>{item.evidence}</p></Card>)}
        </div>
      </Section>
      <Section eyebrow="Commercial validation" title="Measure software adoption separately from merchant sales" className="bg-mist">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><Target className="size-7 text-emerald" /><h2 className="mt-4 text-xl font-bold">The owner is the paying customer</h2><p className="mt-3 leading-7 text-slate-600">The current checkout supports a monthly software subscription. Additional configuration or onboarding work is scoped separately. Annual billing is a proposed option and is not available in the current checkout.</p><p className="mt-3 leading-7 text-slate-600">Compare the subscription collected with cloud, messaging and support costs. Validate pricing with each cohort before expanding.</p></Card>
          <Card><ClipboardList className="size-7 text-emerald" /><h2 className="mt-4 text-xl font-bold">A consistent reporting period</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">{["Merchants completing onboarding and handling their first real order.", "Merchants using the core workflow each week, by cohort.", "Paid subscription customers and recurring subscription value, excluding tax and one-off setup fees.", "Repeat use, merchant retention and support minutes per business.", "Merchant order value, demo data and separate client-service income reported outside subscription revenue."].map(item => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald" />{item}</li>)}</ul></Card>
        </div>
      </Section>
      <Section eyebrow="Incubation request" title="The support that moves the pilot forward">
        <p className="max-w-4xl text-lg leading-8 text-slate-600">We seek merchant introductions, mentoring on pilot design and pricing, and technical reviews of reliability and rollout readiness. Funding and investor discussions should follow a milestone budget and evidence from actual usage.</p>
        <p className="mt-5 max-w-4xl leading-7 text-slate-600">The three-year direction is to establish a repeatable paid offering, strengthen retention and local support, and expand into selected clusters when customer outcomes and operating costs justify it.</p>
        <div className="mt-7"><ButtonLink href="/technology-innovation" variant="secondary">Review the product architecture</ButtonLink></div>
      </Section>
      <PublicFooter />
    </main>
  );
}
