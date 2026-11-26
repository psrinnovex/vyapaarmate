import { ArrowRight, BrainCircuit, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import { Parallax } from "@/components/motion/parallax";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

const suggestions = [
  {
    Icon: Users,
    orb: "bg-clay-kumkum text-white",
    text: "12 regulars have not ordered in 2 weeks",
    action: "Send reminder",
    speed: -0.1
  },
  {
    Icon: TrendingUp,
    orb: "bg-clay-green text-ink",
    text: "Weekend demand for meals is rising",
    action: "Prep more",
    speed: -0.22
  },
  {
    Icon: Wallet,
    orb: "bg-clay-marigold text-ink",
    text: "3 UPI payments pending since yesterday",
    action: "Follow up",
    speed: -0.34
  }
];

/**
 * VyapaarMate Intelligence: explainable owner suggestions, shown as a stack of glass
 * cards that drift apart as the section scrolls by.
 */
export function IntelligenceEngineSection() {
  return (
    <section id="intelligence-engine" aria-labelledby="intelligence-title" className="relative isolate overflow-hidden py-20 lg:py-28">
      <div aria-hidden="true" className="absolute inset-0 -z-10 vm-band" />
      <div aria-hidden="true" className="vm-blob -left-24 top-10 -z-10 size-96 bg-marigold-400 opacity-40" />
      <div aria-hidden="true" className="vm-blob -right-20 bottom-0 -z-10 size-80 bg-brand opacity-30" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <ScrollReveal className="min-w-0 text-white">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-green-200 ring-1 ring-white/15">
            <BrainCircuit className="size-3.5" /> VyapaarMate Intelligence
          </p>
          <h2 id="intelligence-title" className="mt-4 text-[clamp(1.9rem,4.4vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.04em]">
            Smart tips from <span className="text-green-400">your own orders</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-white/70">Clear suggestions you can check. You stay in charge.</p>
          <p className="mt-5 flex max-w-md gap-2 text-sm leading-6 text-white/55">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-300" />
            Early tips use explainable rules and scores; models are trained only when there is enough data from that business.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/technology-innovation" variant="brand" icon={<ArrowRight className="size-4" />} iconPosition="end">
              How it works
            </ButtonLink>
            <ButtonLink href="/grant-readiness" variant="ghost" className="text-white hover:bg-white/10">
              Grant readiness
            </ButtonLink>
          </div>
        </ScrollReveal>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="glass-dark relative rounded-[2rem] p-4 sm:p-5">
            <div className="flex items-center justify-between px-1 pb-3">
              <p className="flex items-center gap-2 text-sm font-extrabold text-white">
                <span className="clay-orb size-8 rounded-xl bg-clay-peacock text-white">
                  <Sparkles className="size-4" />
                </span>
                Today&apos;s tips
              </p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">8:00 AM</span>
            </div>
            <div className="grid gap-3">
              {suggestions.map(({ Icon, orb, text, action, speed }, index) => (
                <Parallax key={text} speed={speed}>
                  <ScrollReveal delay={index * 90} direction="left">
                    <div className="flex items-center gap-3 rounded-[1.4rem] bg-white p-3 shadow-clay sm:p-3.5">
                      <span className={cn("clay-orb size-11 shrink-0 rounded-2xl", orb)}>
                        <Icon className="size-5" />
                      </span>
                      <p className="min-w-0 flex-1 text-sm font-extrabold leading-5 text-ink">{text}</p>
                      <span className="hidden shrink-0 rounded-xl bg-ivory-100 px-3 py-2 text-xs font-extrabold text-peacock-700 sm:inline-flex">{action}</span>
                    </div>
                  </ScrollReveal>
                </Parallax>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-white/45">Example tips with demo data.</p>
        </div>
      </div>
    </section>
  );
}
