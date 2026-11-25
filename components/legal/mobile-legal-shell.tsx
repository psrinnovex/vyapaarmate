import Link from "next/link";
import type { ReactNode } from "react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { BrandMark } from "@/components/ui/brand-mark";
import { Sticker, type StickerTone } from "@/components/ui/sticker";
import { company } from "@/lib/site";
import { cn } from "@/lib/utils";

const legalLinks = [
  { href: "/mobile/privacy", label: "Privacy" },
  { href: "/mobile/terms", label: "Terms" },
  { href: "/account-deletion", label: "Account deletion" }
] as const;

/** Lightweight frame for the app-store legal pages (also opened inside the mobile app). */
export function MobileLegalShell({
  activePath,
  children
}: {
  activePath: (typeof legalLinks)[number]["href"];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-x-clip text-slate-700">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-[1.6rem] px-3 py-2.5 sm:px-4">
          <Link href={activePath} className="flex items-center gap-2.5 font-extrabold text-ink" aria-label={`${company.product} legal information`}>
            <BrandMark />
            <span>{company.product}</span>
          </Link>
          <nav aria-label="Legal information" className="flex flex-wrap items-center gap-1 rounded-2xl bg-white/60 p-1 text-sm font-bold">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={activePath === link.href ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-1.5 transition",
                  activePath === link.href ? "bg-clay-ink text-white shadow-clay-sm" : "text-slate-500 hover:bg-white hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 [counter-reset:legal] sm:px-6 sm:py-12">{children}</div>

      <footer className="px-4 pb-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 rounded-[1.75rem] bg-clay-ink px-5 py-5 text-sm text-white/70 shadow-clay sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-extrabold text-white">{company.product}</span> by {company.name}
          </p>
          <a className="font-bold text-emerald-200 hover:underline" href={`mailto:${company.supportEmail}`}>
            {company.supportEmail}
          </a>
        </div>
      </footer>
    </main>
  );
}

/** Illustrated page header for the legal pages. */
export function LegalHeader({
  eyebrow,
  eyebrowTone = "ocean",
  title,
  updated,
  art,
  children
}: {
  eyebrow: string;
  eyebrowTone?: StickerTone;
  title: string;
  updated?: string;
  art: ClayIllustrationName;
  children?: ReactNode;
}) {
  return (
    <header className="relative mb-8 overflow-hidden rounded-[2.25rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95)_0%,rgba(244,240,255,0.9)_55%,rgba(226,245,254,0.85)_100%)] p-6 shadow-clay sm:p-8">
      <div aria-hidden="true" className="vm-blob -right-12 -top-16 size-56 bg-violet opacity-35" />
      <div className="relative grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <div className="min-w-0">
          <Sticker tone={eyebrowTone} tilt={-3}>{eyebrow}</Sticker>
          <h1 className="mt-4 text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold leading-[1.06] tracking-[-0.04em] text-ink">{title}</h1>
          {updated && <p className="mt-2 text-sm font-semibold text-slate-500">Last updated: {updated}</p>}
          {children && <div className="mt-4 max-w-3xl leading-7 text-slate-600">{children}</div>}
        </div>
        <div aria-hidden="true" className="hidden w-full sm:block">
          <ClayIllustration name={art} className="motion-safe:animate-float-slow" />
        </div>
      </div>
    </header>
  );
}

/** A numbered clay section; numbers come from a CSS counter set on the shell. */
export function LegalSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="clay rounded-[1.75rem] p-5 [counter-increment:legal] sm:p-7">
      <h2 className="flex items-center gap-3 text-xl font-extrabold tracking-[-0.02em] text-ink before:grid before:size-9 before:shrink-0 before:place-items-center before:rounded-xl before:bg-clay-emerald before:text-xs before:font-extrabold before:text-white before:shadow-clay-sm before:content-[counter(legal)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-7">{children}</div>
    </section>
  );
}
