import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Parallax } from "@/components/motion/parallax";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { TiltStage } from "@/components/motion/tilt-stage";
import { Sticker, type StickerTone } from "@/components/ui/sticker";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the public website pages: one hero, split feature rows, tile grids
 * and a closing band, all in the clay & glass style with scroll-driven motion.
 */

export function PublicPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("overflow-x-clip text-ink", className)}>
      <ScrollProgress />
      <PublicHeader />
      {children}
      <PublicFooter />
    </main>
  );
}

export function PageHeroBanner({
  eyebrow,
  eyebrowTone = "mango",
  title,
  highlight,
  body,
  art,
  sideArt = [],
  actions,
  children
}: {
  eyebrow?: string;
  eyebrowTone?: StickerTone;
  title: string;
  /** Words rendered in the brand gradient after the title. */
  highlight?: string;
  body?: string;
  art: ClayIllustrationName;
  /** Up to two small illustrations that float around the main one. */
  sideArt?: ClayIllustrationName[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4 lg:px-8 lg:pb-16 lg:pt-10">
        <ScrollReveal className="min-w-0" direction="right">
          {eyebrow && (
            <Sticker tone={eyebrowTone} tilt={-3}>
              {eyebrow}
            </Sticker>
          )}
          <h1 className="mt-5 text-[clamp(2.3rem,6vw,4.1rem)] font-extrabold leading-[1] tracking-[-0.05em] text-ink">
            {title}
            {highlight && (
              <>
                {" "}
                <span className="text-gradient-brand">{highlight}</span>
              </>
            )}
          </h1>
          {body && <p className="mt-5 max-w-xl text-base font-medium leading-7 text-slate-600 sm:text-lg">{body}</p>}
          {actions && <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
          {children}
        </ScrollReveal>
        <TiltStage className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[28rem] lg:max-w-[32rem]">
          <div aria-hidden="true" className="vm-blob left-[6%] top-[8%] size-[56%] bg-violet motion-safe:animate-blob-drift" />
          <div aria-hidden="true" className="vm-blob bottom-[8%] right-[4%] size-[50%] bg-emerald motion-safe:animate-blob-drift [animation-delay:-7s]" />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 size-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_28%,#ffffff_0%,#f3f0ff_48%,#e6e0fb_100%)] shadow-[0_50px_90px_-40px_rgba(55,41,130,0.45),inset_0_-18px_40px_rgba(124,92,255,0.12),inset_0_10px_24px_rgba(255,255,255,0.95)]"
          />
          <div className="absolute inset-[14%] grid place-items-center">
            <Parallax anchor="top" speed={-0.1} className="w-full">
              <ClayIllustration name={art} className="motion-safe:animate-float-slow" />
            </Parallax>
          </div>
          {sideArt[0] && (
            <Parallax anchor="top" speed={-0.45} rotate={-10} className="absolute left-[-2%] top-[4%] w-[30%]">
              <ClayIllustration name={sideArt[0]} className="motion-safe:animate-float [animation-delay:-2s]" />
            </Parallax>
          )}
          {sideArt[1] && (
            <Parallax anchor="top" speed={-0.3} rotate={8} className="absolute bottom-[2%] right-[-2%] w-[30%]">
              <ClayIllustration name={sideArt[1]} className="motion-safe:animate-float-slow [animation-delay:-4s]" />
            </Parallax>
          )}
        </TiltStage>
      </div>
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  highlight,
  body,
  align = "center",
  id
}: {
  eyebrow?: string;
  title: string;
  highlight?: string;
  body?: string;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <ScrollReveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p className="inline-flex rounded-full bg-emerald-soft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-emerald-deep">{eyebrow}</p>
      )}
      <h2 id={id} className="mt-3 scroll-mt-24 text-[clamp(1.8rem,4.2vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">
        {title}
        {highlight && (
          <>
            {" "}
            <span className="text-gradient-brand">{highlight}</span>
          </>
        )}
      </h2>
      {body && <p className="mt-3 text-base font-medium leading-7 text-slate-600">{body}</p>}
    </ScrollReveal>
  );
}

export const tintClass = {
  emerald: "clay-tint-emerald",
  violet: "clay-tint-violet",
  mango: "clay-tint-mango",
  berry: "clay-tint-berry",
  ocean: "clay-tint-ocean",
  sky: "clay-tint-sky"
} as const;

export type Tint = keyof typeof tintClass;

/** Alternating picture + text row. The picture panel drifts slightly against the scroll. */
export function FeatureRow({
  art,
  tint = "violet",
  eyebrow,
  title,
  body,
  points = [],
  reverse = false,
  children
}: {
  art: ClayIllustrationName;
  tint?: Tint;
  eyebrow?: string;
  title: string;
  body?: string;
  points?: string[];
  reverse?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <ScrollReveal direction={reverse ? "left" : "right"} className={cn("min-w-0", reverse && "lg:order-2")}>
        <div className={cn("clay relative grid aspect-[5/4] place-items-center overflow-hidden rounded-[2.25rem]", tintClass[tint])}>
          <div aria-hidden="true" className="dotted-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(circle,black_20%,transparent_70%)]" />
          <Parallax speed={-0.14} className="relative w-[58%]">
            <ClayIllustration name={art} />
          </Parallax>
        </div>
      </ScrollReveal>
      <ScrollReveal direction={reverse ? "right" : "left"} className="min-w-0">
        {eyebrow && <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-violet-deep">{eyebrow}</p>}
        <h3 className="mt-2 text-[clamp(1.6rem,3.2vw,2.4rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-ink">{title}</h3>
        {body && <p className="mt-3 max-w-lg text-base font-medium leading-7 text-slate-600">{body}</p>}
        {points.length > 0 && (
          <ul className="mt-5 grid gap-2.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-slate-700">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-soft text-emerald-deep">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        )}
        {children}
      </ScrollReveal>
    </div>
  );
}

const orbTone = {
  emerald: "bg-clay-emerald text-white",
  violet: "bg-clay-violet text-white",
  mango: "bg-clay-mango text-ink",
  berry: "bg-clay-berry text-white",
  ocean: "bg-clay-ocean text-white",
  ink: "bg-clay-ink text-white"
} as const;

export type OrbTone = keyof typeof orbTone;

export function IconTile({
  icon,
  tone = "emerald",
  title,
  body,
  delay = 0,
  className
}: {
  icon: ReactNode;
  tone?: OrbTone;
  title: string;
  body?: string;
  delay?: number;
  className?: string;
}) {
  return (
    <ScrollReveal delay={delay} className={cn("h-full", className)}>
      <div className="clay flex h-full flex-col rounded-[1.75rem] p-5 transition hover:-translate-y-1 hover:shadow-clay-lg">
        <span className={cn("clay-orb size-12 rounded-2xl", orbTone[tone])}>{icon}</span>
        <h3 className="mt-4 text-base font-extrabold tracking-[-0.01em] text-ink">{title}</h3>
        {body && <p className="mt-1.5 text-sm font-medium leading-6 text-slate-500">{body}</p>}
      </div>
    </ScrollReveal>
  );
}

/** Gradient closing band with an illustration that lifts as it scrolls in. */
export function CtaBand({
  title,
  body,
  art = "rocket",
  children
}: {
  title: string;
  body?: string;
  art?: ClayIllustrationName;
  children?: ReactNode;
}) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#12b76a_0%,#4f5bd5_55%,#7c5cff_100%)] px-6 py-12 text-white shadow-clay-lg sm:px-12">
          <div aria-hidden="true" className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_0.6fr]">
            <div>
              <h2 className="max-w-xl text-[clamp(1.9rem,4.6vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.045em]">{title}</h2>
              {body && <p className="mt-3 max-w-md text-base font-semibold text-white/80">{body}</p>}
              {children && <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>}
            </div>
            <Parallax speed={-0.4} rotate={6} className="mx-auto w-36 sm:w-48 md:w-full md:max-w-[14rem]">
              <ClayIllustration name={art} />
            </Parallax>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/**
 * Cards that pin one after another as you scroll, so each new card slides over the last
 * and the set ends as a neat stack (CSS sticky only — no scroll listeners).
 */
export function StackCards({
  items
}: {
  items: { title: string; body: string; icon: ReactNode; art: ClayIllustrationName; tint: Tint; tone: OrbTone }[];
}) {
  return (
    <ol className="grid gap-5">
      {items.map((item, index) => (
        <li key={item.title} className="sticky" style={{ top: `calc(5.75rem + ${index * 1.1}rem)` }}>
          <div className={cn("clay relative grid min-h-[13rem] items-center gap-5 overflow-hidden rounded-[2rem] p-6 sm:grid-cols-[1fr_11rem] sm:p-8", tintClass[item.tint])}>
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <span className={cn("clay-orb size-12 shrink-0 rounded-2xl", orbTone[item.tone])}>{item.icon}</span>
                <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Layer {String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] text-ink">{item.title}</h3>
              <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600">{item.body}</p>
            </div>
            <div aria-hidden="true" className="absolute right-4 top-4 w-16 sm:relative sm:right-auto sm:top-auto sm:w-full">
              <ClayIllustration name={item.art} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
