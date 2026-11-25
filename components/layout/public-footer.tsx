import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { company } from "@/lib/constants";

const developerWebsite = "https://pshrinnovex.com";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Live demo" },
      { href: "/install", label: "Install app" }
    ]
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/technology-innovation", label: "Technology" },
      { href: "/grant-readiness", label: "Grant readiness" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/account-deletion", label: "Delete account" }
    ]
  }
];

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden px-3 pb-3 pt-6 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-clay-ink text-white shadow-clay-lg">
        <div className="grid gap-10 px-6 pb-6 pt-10 sm:px-10 md:grid-cols-[1.3fr_repeat(3,minmax(0,0.7fr))]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-extrabold tracking-[-0.02em]">
              <BrandMark surface="dark" />
              {company.product}
            </Link>
            <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-white/60">Orders, UPI payments and WhatsApp updates for local businesses.</p>
            <div className="mt-5 grid gap-2 text-sm font-semibold text-white/70">
              <a href={`mailto:${company.supportEmail}`} className="inline-flex items-center gap-2 transition hover:text-white">
                <Mail className="size-4 text-emerald-300" /> {company.supportEmail}
              </a>
              {company.phone && (
                <span className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-emerald-300" /> {company.phone}
                </span>
              )}
            </div>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/40">{column.title}</p>
              <ul className="mt-4 grid gap-2.5 text-sm font-bold text-white/75">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p
          aria-hidden="true"
          className="select-none bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0))] bg-clip-text px-4 text-center text-[clamp(3.2rem,15vw,11rem)] font-extrabold leading-[0.8] tracking-[-0.06em] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.12)]"
        >
          VyapaarMate
        </p>
        <div className="flex flex-col gap-2 border-t border-white/10 px-6 py-5 text-xs font-semibold text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span>
            © {new Date().getFullYear()} {company.name}
          </span>
          <span>
            Designed and developed by{" "}
            <a href={developerWebsite} target="_blank" rel="noopener noreferrer" className="font-extrabold text-white transition hover:text-emerald-300">
              {company.name.toUpperCase()}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
