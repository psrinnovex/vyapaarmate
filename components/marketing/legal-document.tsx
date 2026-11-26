"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * Long-form document layout with a sticky table of contents that follows the reader:
 * the section currently in view is highlighted (IntersectionObserver scroll-spy) and a
 * thin bar shows how far through the document they are.
 */
export function LegalDocument({ sections, updated }: { sections: LegalSection[]; updated?: string }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const nodes = sections.map((section) => document.getElementById(section.id)).filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    nodes.forEach((node) => observer.observe(node));

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const first = nodes[0].getBoundingClientRect().top + window.scrollY;
        const last = nodes[nodes.length - 1];
        const end = last.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
        const value = end > first ? (window.scrollY - first) / (end - first) : 1;
        setProgress(Math.min(1, Math.max(0, value)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10 lg:px-8">
      <nav aria-label="On this page" className="sticky top-[5.5rem] z-20 self-start">
        <div className="glass rounded-[1.5rem] p-2 lg:p-3">
          <p className="hidden px-2 pb-2 pt-1 text-xs font-extrabold uppercase tracking-[0.1em] text-ink-500 lg:block">On this page</p>
          <div className="mx-2 mb-2 hidden h-1.5 overflow-hidden rounded-full bg-ivory-100 lg:block">
            <div className="h-full origin-left rounded-full bg-brand transition-transform duration-150" style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
          </div>
          <ol className="scrollbar-none flex gap-1 overflow-x-auto lg:grid lg:overflow-visible">
            {sections.map((section, index) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  aria-current={active === section.id ? "location" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
                    active === section.id ? "bg-clay-ink text-white shadow-clay-sm theme-dark" : "text-ink-500 hover:bg-white hover:text-ink"
                  )}
                >
                  <span className={cn("text-[11px] font-extrabold", active === section.id ? "text-green-300" : "text-ink-300")}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>
      <article className="min-w-0">
        {updated && <p className="mb-4 text-sm font-semibold text-ink-500">Last updated {updated}</p>}
        <div className="grid gap-4">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="clay scroll-mt-28 rounded-[1.75rem] p-6 sm:p-7">
              <h2 className="flex items-center gap-3 text-xl font-extrabold tracking-[-0.02em] text-ink">
                <span className="clay-orb size-9 shrink-0 rounded-xl bg-clay-green text-xs font-extrabold text-ink">{index + 1}</span>
                {section.title}
              </h2>
              <div className="mt-3 grid gap-3 text-[15px] leading-7 text-ink-600 [&_a]:font-bold [&_a]:text-brand-text [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">{section.body}</div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
