import { Plus } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

/** FAQ as clay accordions (native <details>, so it works without JavaScript). */
export function FaqSection({ items }: { items: ReadonlyArray<readonly string[]> }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
      <ScrollReveal className="text-center">
        <p className="inline-flex rounded-full bg-ocean-soft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-ocean-deep">FAQ</p>
        <h2 id="faq-title" className="mt-3 text-[clamp(1.9rem,4.4vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink">
          Quick answers
        </h2>
      </ScrollReveal>
      <div className="mt-8 grid gap-3">
        {items.map(([question, answer], index) => (
          <ScrollReveal key={question} delay={index * 50}>
            <details className="group clay rounded-[1.5rem] px-5 py-4 open:pb-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-extrabold text-ink">
                {question}
                <span className="clay-orb size-8 shrink-0 rounded-xl bg-clay-emerald text-white transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none">
                  <Plus className="size-4" />
                </span>
              </summary>
              <p className="mt-3 pr-10 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
