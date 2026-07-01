import Link from "next/link";
import { company } from "@/lib/constants";

const developerWebsite = "https://pshrinnovex.com";

export function PublicFooter() {
  return (
    <footer className="bg-ink px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 font-bold">
              <span className="grid size-9 place-items-center rounded-lg bg-white text-ink">VM</span>
              <span>{company.product}</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
              Website orders, bookings, payments, WhatsApp updates, and customer management software by {company.name}.
            </p>
          </div>
          <div>
            <p className="font-bold">Company</p>
            <div className="mt-3 grid gap-2 text-sm text-white/70">
              <Link href="/contact" className="transition hover:text-white">
                Contact
              </Link>
              <Link href="/technology-innovation" className="transition hover:text-white">
                Technology & Innovation
              </Link>
              <Link href="/grant-readiness" className="transition hover:text-white">
                Grant Readiness
              </Link>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
            </div>
          </div>
          <div>
            <p className="font-bold">Support</p>
            <div className="mt-3 grid gap-2 text-sm text-white/70">
              <span>{company.supportEmail}</span>
              {company.phone && <span>{company.phone}</span>}
              <span>{company.name}</span>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-5 text-sm text-white/60">
          Designed and developed by{" "}
          <a
            href={developerWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-white transition hover:text-emerald"
          >
            {company.name.toUpperCase()}
          </a>
        </div>
      </div>
    </footer>
  );
}
