import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ClipboardList, Info, MapPin, Target } from "lucide-react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { CtaBand, PageHeroBanner, PublicPage, SectionTitle, tintClass } from "@/components/marketing/page-kit";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createMetadata } from "@/lib/seo";

const description = "VyapaarMate incubation and pilot plan: direct orders, payment status and customer follow-up, with separate Bengaluru and Andhra Pradesh cohorts.";
export const metadata: Metadata = createMetadata({ title: "Incubation and Pilot Plan", description, path: "/grant-readiness" });

const workflow: { title: string; body: string; art: ClayIllustrationName }[] = [
  { title: "Receive", body: "A customer places a direct order or booking through the business catalog.", art: "bag" },
  { title: "Operate", body: "The owner and authorised staff track fulfilment and payment status in one workspace.", art: "shop" },
  { title: "Follow up", body: "Customer records and permitted updates support service and repeat visits.", art: "phone" },
  { title: "Learn", body: "Explainable rules highlight actions. The pilot measures whether they help the owner.", art: "chart" }
];
const milestones = [
  { period: "Days 1–30", title: "Understand the merchant", target: "20 owner interviews", body: "Recruit across the two cohorts, choose one initial food-business segment in each, and rehearse the complete demo.", evidence: "Dated interview notes, workflow baseline and agreed pilot scope.", art: "customers" as const },
  { period: "Days 31–60", title: "Observe real operations", target: "5 consenting pilot businesses", body: "Record onboarding effort and observe order handling. Report each cohort separately; the five-business target is across both cohorts.", evidence: "Weekly usage, support effort, consent records and merchant feedback.", art: "shop" as const },
  { period: "Days 61–90", title: "Review willingness to pay", target: "Review repeat use", body: "Compare paid conversion, continued use and service costs. Decide whether to improve, extend or pause each cohort.", evidence: "Usage trends, paid subscription records and a decision on the next cohort.", art: "upi" as const }
];
const reportingItems = [
  "Merchants completing onboarding and handling their first real order.",
  "Merchants using the core workflow each week, by cohort.",
  "Paid subscription customers and recurring subscription value, excluding tax and one-off setup fees.",
  "Repeat use, merchant retention and support minutes per business.",
  "Merchant order value, demo data and separate client-service income reported outside subscription revenue."
];

export default function GrantReadinessPage() {
  return (
    <PublicPage>
      <PageHeroBanner
        eyebrow="PSHR INNOVEX PRIVATE LIMITED"
        eyebrowTone="green"
        title="A focused merchant pilot with"
        highlight="measurable outcomes"
        body="VyapaarMate brings direct orders, payment status and customer follow-up into one workspace. Our incubation plan is to test that workflow with local food businesses and use the evidence to improve the product and subscription model."
        art="rocket"
        sideArt={["chart", "tiffin"]}
        actions={
          <>
            <ButtonLink href="/b/fresh-bowl-cloud-kitchen" size="lg" icon={<ArrowRight className="size-5" />} iconPosition="end">
              Explore the demo catalog
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="secondary">
              Discuss a pilot or product review
            </ButtonLink>
          </>
        }
      >
        <p className="mt-6 flex max-w-xl gap-2.5 rounded-2xl bg-marigold-50/80 p-3 text-xs font-semibold leading-5 text-marigold-700">
          <Info className="mt-0.5 size-4 shrink-0" />
          Proposed incubation work. The targets below are not completed interviews, customers, revenue, funding or confirmation of admission to any programme.
        </p>
      </PageHeroBanner>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Core product" title="One connected" highlight="operating workflow" />
        <div className="relative mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-12 hidden border-t-2 border-dashed border-peacock-600/25 xl:block" />
          {workflow.map((step, index) => (
            <ScrollReveal key={step.title} delay={index * 90} className="h-full">
              <article className="clay relative flex h-full flex-col items-center rounded-[2rem] p-6 text-center">
                <span className="grid size-24 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#ffffff_0%,#f3eee2_60%,#e6dfcf_100%)] p-3 shadow-clay-inset">
                  <ClayIllustration name={step.art} />
                </span>
                <span className="mt-4 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-extrabold text-green-700">0{index + 1}</span>
                <h2 className="mt-2 text-xl font-extrabold tracking-[-0.02em]">{step.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-ink-600">{step.body}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs font-semibold leading-5 text-ink-500">
          Catalogs, orders, booking tools, staff roles and decision-support modules are implemented in the product. Payment-provider confirmation and WhatsApp delivery depend on configured services and must be verified for a live pilot. Recommendation accuracy remains a validation task.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Market entry" title="Two cohorts with" highlight="separate evidence" />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {[
            {
              name: "Bengaluru",
              art: "shop" as const,
              tint: "peacock" as const,
              body: "Build on local outreach to food businesses. Measure onboarding, weekly use and willingness to pay within this cohort.",
              note: "Any Bengaluru launch discount applies only to eligible Bengaluru businesses and is confirmed at checkout."
            },
            {
              name: "Andhra Pradesh",
              art: "tiffin" as const,
              tint: "marigold" as const,
              body: "Seek introductions through RTIH for a separate cohort of tiffin centres and small restaurants. Start from the founder’s Kadapa and Tirupati connections.",
              note: "Confirm the local segment, merchant consent and pilot terms before onboarding. Track this cohort separately from Bengaluru."
            }
          ].map((cohort, index) => (
            <ScrollReveal key={cohort.name} delay={index * 90} direction={index ? "left" : "right"} className="h-full">
              <article className="clay flex h-full flex-col overflow-hidden rounded-[2rem]">
                <div className={cn("relative flex h-40 items-end justify-between px-6 pb-4", tintClass[cohort.tint])}>
                  <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-extrabold text-ink shadow-clay-sm">
                    <MapPin className="size-4 text-kumkum-700" />
                    {cohort.name}
                  </span>
                  <ClayIllustration name={cohort.art} className="h-32 w-32" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-base font-medium leading-7 text-ink-700">{cohort.body}</p>
                  <p className="mt-4 border-t border-ink-200/70 pt-4 text-sm leading-6 text-ink-500">{cohort.note}</p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Proposed first 90 days" title="Turn a working demo into" highlight="useful merchant evidence" />
        <div className="relative mt-12">
          <span aria-hidden="true" className="absolute bottom-6 left-6 top-6 w-1.5 rounded-full bg-ivory-100 sm:left-9" />
          <span aria-hidden="true" className="vm-fill-on-scroll absolute bottom-6 left-6 top-6 w-1.5 rounded-full bg-brand sm:left-9" />
        <ol className="relative grid gap-8 pl-14 sm:pl-20">
          {milestones.map((item, index) => (
            <li key={item.period} className="relative">
              <span className="absolute -left-14 top-4 grid size-12 place-items-center rounded-2xl bg-white p-1.5 shadow-clay sm:-left-20 sm:size-[4.5rem] sm:rounded-3xl sm:p-2">
                <ClayIllustration name={item.art} />
              </span>
              <ScrollReveal delay={index * 60} direction="left">
                <article className="clay rounded-[2rem] p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-clay-ink px-3 py-1 text-xs font-extrabold text-white theme-dark">{item.period}</span>
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-extrabold text-green-700">{item.target}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.03em]">{item.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-ink-600">{item.body}</p>
                  <p className="mt-4 rounded-2xl bg-ivory-100/80 p-3 text-sm leading-6 text-ink-600">
                    <span className="font-bold text-ink">Evidence to review: </span>
                    {item.evidence}
                  </p>
                </article>
              </ScrollReveal>
            </li>
          ))}
        </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Commercial validation" title="Measure software adoption" highlight="separately from merchant sales" />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <ScrollReveal direction="right" className="h-full">
            <article className="clay h-full rounded-[2rem] p-7">
              <span className="clay-orb size-12 rounded-2xl bg-clay-green text-ink">
                <Target className="size-6" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold">The owner is the paying customer</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-ink-600">The current checkout supports a monthly software subscription. Additional configuration or onboarding work is scoped separately. Annual billing is a proposed option and is not available in the current checkout.</p>
              <p className="mt-3 text-sm font-medium leading-6 text-ink-600">Compare the subscription collected with cloud, messaging and support costs. Validate pricing with each cohort before expanding.</p>
            </article>
          </ScrollReveal>
          <ScrollReveal direction="left" delay={90} className="h-full">
            <article className="relative h-full overflow-hidden rounded-[2rem] vm-band p-7 text-white shadow-clay-lg">
              <span className="clay-orb size-12 rounded-2xl bg-clay-peacock text-white">
                <ClipboardList className="size-6" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold">A consistent reporting period</h2>
              <ul className="mt-4 grid gap-2.5">
                {reportingItems.map((item) => (
                  <li key={item} className="flex gap-2.5 rounded-2xl bg-white/10 p-3 text-sm font-medium leading-6 text-white/85 ring-1 ring-white/10">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </ScrollReveal>
        </div>
      </section>

      <CtaBand
        title="The support that moves the pilot forward"
        body="We seek merchant introductions, mentoring on pilot design and pricing, and technical reviews of reliability and rollout readiness. Funding and investor discussions should follow a milestone budget and evidence from actual usage."
        art="rocket"
      >
        <ButtonLink href="/technology-innovation" size="lg" variant="dark">
          Review the product architecture
        </ButtonLink>
        <ButtonLink href="/contact" size="lg" variant="secondary">
          Discuss a pilot
        </ButtonLink>
      </CtaBand>
      <p className="mx-auto -mt-8 max-w-3xl px-4 pb-14 text-center text-sm font-medium leading-6 text-ink-500">
        The three-year direction is to establish a repeatable paid offering, strengthen retention and local support, and expand into selected clusters when customer outcomes and operating costs justify it.
      </p>
    </PublicPage>
  );
}
