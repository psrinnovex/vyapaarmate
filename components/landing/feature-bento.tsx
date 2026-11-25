import type { ReactNode } from "react";
import { BadgeCheck, Bell, CalendarDays, Check, IndianRupee, MessageCircle, ReceiptText, ShieldCheck, Store, TrendingUp, Users, X } from "lucide-react";
import {
  CalendarIllustration,
  ChartIllustration,
  CustomersIllustration,
  PhoneChatIllustration,
  ShieldIllustration,
  UpiQrIllustration
} from "@/components/illustrations/clay-illustrations";
import { CountUp } from "@/components/motion/count-up";
import { Parallax } from "@/components/motion/parallax";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

function Tile({
  title,
  line,
  icon,
  className,
  children,
  delay = 0,
  bodyClassName = "mt-auto"
}: {
  title: string;
  line: string;
  icon: ReactNode;
  className?: string;
  children?: ReactNode;
  delay?: number;
  bodyClassName?: string;
}) {
  return (
    <ScrollReveal delay={delay} className={cn("min-w-0", className)}>
      <article className="clay relative flex h-full min-h-[15rem] flex-col overflow-hidden rounded-[2rem] p-5">
        <div className="relative z-10 flex items-center gap-2.5">
          {icon}
          <h3 className="text-base font-extrabold tracking-[-0.01em] text-ink">{title}</h3>
        </div>
        <p className="relative z-10 mt-1.5 max-w-[22rem] text-sm font-semibold leading-6 text-slate-500">{line}</p>
        <div className={cn("relative", bodyClassName)}>{children}</div>
      </article>
    </ScrollReveal>
  );
}

const orb = (tone: string, children: ReactNode) => <span className={cn("clay-orb size-9 shrink-0 rounded-xl", tone)}>{children}</span>;

const lanes = [
  { title: "New", tone: "bg-ocean", cards: [["#2051", "Idli Vada x2", "UPI paid"], ["#2052", "Mini Meals", "Cash"]] },
  { title: "Preparing", tone: "bg-mango", cards: [["#2049", "Lassi x3", "UPI paid"]] },
  { title: "Ready", tone: "bg-emerald", cards: [["#2047", "Thali", "Pickup"], ["#2046", "Dosa x2", "Delivery"]] }
];

/** Feature overview as a bento grid of clay tiles. Numbers inside are demo data. */
export function FeatureBento() {
  return (
    <section id="product" aria-labelledby="product-title" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="inline-flex rounded-full bg-emerald-soft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-emerald-deep">
          Everything in one app
        </p>
        <h2 id="product-title" className="mt-3 text-[clamp(1.9rem,4.4vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink">
          Run the whole shop <span className="text-gradient-brand">from your phone</span>
        </h2>
      </ScrollReveal>

      <div className="mt-10 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          className="sm:col-span-2 lg:row-span-2"
          bodyClassName="mt-2 flex flex-1 flex-col justify-between"
          title="Live orders board"
          line="Accept, prepare, hand over. Every order in one place."
          icon={orb("bg-clay-ocean text-white", <Store className="size-4" />)}
        >
          <div className="mb-4 mt-5 grid grid-cols-3 gap-2.5 rounded-[1.5rem] bg-mist/80 p-2.5 shadow-clay-inset">
            {lanes.map((lane) => (
              <div key={lane.title} className="min-w-0">
                <p className="flex items-center gap-1.5 px-1 text-[11px] font-extrabold text-slate-500">
                  <span className={cn("size-2 rounded-full", lane.tone)} /> {lane.title}
                </p>
                <div className="mt-2 grid gap-2">
                  {lane.cards.map(([id, item, tag]) => (
                    <div key={id} className="rounded-2xl bg-white p-2.5 shadow-clay-sm">
                      <p className="text-[11px] font-extrabold text-slate-400">{id}</p>
                      <p className="truncate text-xs font-extrabold text-ink">{item}</p>
                      <p className="mt-1 inline-flex rounded-full bg-emerald-soft px-2 py-0.5 text-[10px] font-bold text-emerald-deep">{tag}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="glass flex items-center gap-3 rounded-[1.4rem] p-2.5 pr-3">
            <span className="clay-orb size-11 shrink-0 rounded-2xl bg-clay-mango text-ink motion-safe:animate-wiggle">
              <Bell className="size-5" />
            </span>
            <p className="min-w-0 flex-1 leading-tight">
              <span className="block text-[11px] font-bold text-slate-500">New order · just now</span>
              <span className="block truncate text-sm font-extrabold text-ink">Priya · Mini Meals x2 · ₹240</span>
            </p>
            <span className="grid size-9 place-items-center rounded-xl bg-white text-berry-deep shadow-clay-sm">
              <X className="size-4" />
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-clay-emerald text-white shadow-clay-sm">
              <Check className="size-4" strokeWidth={3} />
            </span>
          </div>
        </Tile>

        <Tile delay={60} title="UPI payments" line="QR on every order. Paid or pending, at a glance." icon={orb("bg-clay-violet text-white", <IndianRupee className="size-4" />)}>
          <div className="flex items-end justify-between gap-2">
            <p className="pb-2">
              <span className="block text-[11px] font-bold text-slate-400">Today</span>
              <CountUp to={18400} prefix="₹" className="text-2xl font-extrabold tracking-[-0.03em] text-ink" />
            </p>
            <Parallax speed={-0.12} className="w-[46%]">
              <UpiQrIllustration />
            </Parallax>
          </div>
        </Tile>

        <Tile delay={120} title="WhatsApp updates" line="Customers hear from you at every step." icon={orb("bg-clay-emerald text-white", <MessageCircle className="size-4" />)}>
          <Parallax speed={-0.1} className="ml-auto w-[52%]">
            <PhoneChatIllustration />
          </Parallax>
        </Tile>

        <Tile delay={60} title="Repeat customers" line="Know your regulars. Remind them gently." icon={orb("bg-clay-berry text-white", <Users className="size-4" />)}>
          <div className="flex items-end justify-between gap-2">
            <p className="pb-2">
              <span className="block text-[11px] font-bold text-slate-400">Come back</span>
              <CountUp to={42} suffix="%" className="text-2xl font-extrabold tracking-[-0.03em] text-ink" />
            </p>
            <Parallax speed={-0.12} className="w-[56%]">
              <CustomersIllustration />
            </Parallax>
          </div>
        </Tile>

        <Tile delay={120} title="Bookings" line="Slots for salons, classes and services." icon={orb("bg-clay-mango text-ink", <CalendarDays className="size-4" />)}>
          <Parallax speed={-0.1} className="ml-auto w-[48%]">
            <CalendarIllustration />
          </Parallax>
        </Tile>

        <Tile className="sm:col-span-2" title="Daily reports" line="Sales, top items and pending money, every evening." icon={orb("bg-clay-ocean text-white", <TrendingUp className="size-4" />)}>
          <div className="flex items-end justify-between gap-4">
            <div className="grid flex-1 grid-cols-3 gap-2 pb-2">
              {[
                ["Orders", 46, ""],
                ["Avg bill", 214, "₹"],
                ["New", 9, ""]
              ].map(([label, value, prefix]) => (
                <div key={label as string} className="rounded-2xl bg-white/80 p-2.5 text-center shadow-clay-sm">
                  <CountUp to={value as number} prefix={prefix as string} className="block text-lg font-extrabold text-ink" />
                  <span className="text-[11px] font-bold text-slate-400">{label}</span>
                </div>
              ))}
            </div>
            <Parallax speed={-0.12} className="w-[32%] max-w-[10rem]">
              <ChartIllustration />
            </Parallax>
          </div>
        </Tile>

        <Tile delay={60} title="Staff roles" line="Give each person only what they need." icon={orb("bg-clay-ink text-white", <ShieldCheck className="size-4" />)}>
          <Parallax speed={-0.1} className="ml-auto w-[44%]">
            <ShieldIllustration />
          </Parallax>
        </Tile>

        <Tile delay={120} title="GST invoices" line="Bills your customers can download." icon={orb("bg-clay-emerald text-white", <ReceiptText className="size-4" />)}>
          <div className="ml-auto w-[70%] rotate-[-4deg] rounded-2xl bg-white p-3 shadow-clay">
            <p className="flex items-center justify-between text-[11px] font-extrabold text-ink">
              Invoice <BadgeCheck className="size-4 text-emerald" />
            </p>
            {[64, 82, 48].map((width) => (
              <span key={width} className="mt-1.5 block h-1.5 rounded-full bg-mist" style={{ width: `${width}%` }} />
            ))}
            <p className="mt-2 text-right text-xs font-extrabold text-ink">₹1,240</p>
          </div>
        </Tile>
      </div>
      <p className="mt-4 text-center text-xs font-semibold text-slate-400">Screens show demo data.</p>
    </section>
  );
}
