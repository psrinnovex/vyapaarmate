import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { company } from "@/lib/site";
import { cn } from "@/lib/utils";

const legalLinks = [
  { href: "/mobile/privacy", label: "Privacy" },
  { href: "/mobile/terms", label: "Terms" },
  { href: "/account-deletion", label: "Account deletion" }
] as const;

export function MobileLegalShell({
  activePath,
  children
}: {
  activePath: (typeof legalLinks)[number]["href"];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-mesh-light text-slate-700">
      <header className="border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <Link href={activePath} className="flex items-center gap-3 font-extrabold text-ink" aria-label={`${company.product} legal information`}>
            <BrandMark />
            <span>{company.product}</span>
          </Link>
          <nav aria-label="Legal information" className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={activePath === link.href ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 transition",
                  activePath === link.href ? "bg-ink text-white" : "text-slate-600 hover:bg-mist hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>

      <footer className="border-t border-line bg-white px-4 py-8 text-sm text-slate-600 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-bold text-ink">{company.product}</span> by {company.name}</p>
          <a className="font-semibold text-ocean hover:underline" href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-[0_16px_48px_rgba(13,19,33,0.05)] sm:p-7">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 leading-7">{children}</div>
    </section>
  );
}
