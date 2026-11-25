import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FlaskConical, MessageCircle, QrCode, ShoppingBag } from "lucide-react";
import {
  BagIllustration,
  PhoneChatIllustration,
  ShieldIllustration,
  ShopIllustration,
  TiffinIllustration
} from "@/components/illustrations/clay-illustrations";
import { DemoLoginCards, type DemoRoleCard } from "@/components/demo/demo-login-cards";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { ButtonLink } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { demoShopSlug, isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live demo",
  description: "Try VyapaarMate as a customer, shop owner, staff member or admin.",
  robots: { index: false, follow: true }
};

const roleCards: DemoRoleCard[] = [
  { role: "owner", title: "Shop owner", line: "Orders, money and customers", tint: "clay-tint-emerald", art: <ShopIllustration /> },
  { role: "staff", title: "Kitchen staff", line: "Prepare and hand over", tint: "clay-tint-mango", art: <TiffinIllustration /> },
  { role: "admin", title: "Platform admin", line: "Approve shops, watch payments", tint: "clay-tint-ocean", art: <ShieldIllustration /> },
  { role: "support", title: "Support agent", line: "Answer tickets", tint: "clay-tint-violet", art: <PhoneChatIllustration /> }
];

const journey = [
  { Icon: ShoppingBag, label: "Order as a customer" },
  { Icon: QrCode, label: "Pay with Demo UPI" },
  { Icon: MessageCircle, label: "See it live as the owner" }
];

export default function DemoPage() {
  const demo = isDemoMode();

  return (
    <main className="overflow-x-clip text-ink">
      <PublicHeader />
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-14">
        <div className="mx-auto max-w-2xl text-center">
          <Sticker tone="mango" tilt={-4} icon={<FlaskConical className="size-3.5" />}>
            {demo ? "Demo environment" : "Live demo"}
          </Sticker>
          <h1 className="mt-5 text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1] tracking-[-0.045em]">
            Try it in <span className="text-gradient-brand">one tap</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base font-medium text-slate-600 sm:text-lg">
            {demo ? "Pick a role. Payments and WhatsApp are simulated, so no real money moves." : "Order from a demo shop, or book a guided tour of the owner app."}
          </p>
        </div>

        <ol className="mx-auto mt-8 flex max-w-3xl flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
          {journey.map(({ Icon, label }, index) => (
            <li key={label} className="flex items-center gap-2 sm:contents">
              <span className="glass flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-extrabold sm:flex-none">
                <span className="clay-orb size-8 rounded-xl bg-clay-emerald text-white">
                  <Icon className="size-4" />
                </span>
                {label}
              </span>
              {index < journey.length - 1 && <ArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-slate-400 sm:block" />}
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={`/b/${demoShopSlug}`}
            className="group relative flex min-h-[17rem] flex-col overflow-hidden rounded-[2rem] bg-clay-ink p-5 text-white shadow-clay-lg transition hover:-translate-y-1 sm:col-span-2 lg:col-span-1 lg:row-span-2"
          >
            <Sticker tone="emerald" tilt={-5} className="self-start">
              No sign-in
            </Sticker>
            <div className="flex flex-1 items-center justify-center py-4">
              <BagIllustration className="w-44 transition-transform duration-300 group-hover:scale-105 lg:w-56" />
            </div>
            <span className="text-2xl font-extrabold tracking-[-0.03em]">Order as a customer</span>
            <span className="mt-1 text-sm font-semibold text-white/70">Browse the menu, pay and track the order.</span>
            <span className="mt-4 inline-flex items-center gap-2 self-start rounded-2xl bg-clay-emerald px-4 py-2.5 text-sm font-extrabold shadow-clay-sm">
              Open demo shop <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          {demo ? (
            <DemoLoginCards cards={roleCards} />
          ) : (
            <div className="clay clay-tint-violet flex flex-col justify-between rounded-[2rem] p-6 sm:col-span-2">
              <div>
                <p className="text-xl font-extrabold tracking-[-0.02em]">Want the owner tour?</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">We will walk you through the dashboard on a call.</p>
              </div>
              <ButtonLink href="/contact" className="mt-6 self-start" icon={<ArrowRight className="size-4" />} iconPosition="end">
                Book a guided demo
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
