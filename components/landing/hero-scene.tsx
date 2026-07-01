"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  BagTick,
  CalendarTick,
  Card,
  Category,
  Chart2,
  ChartSuccess,
  DirectboxNotif,
  Location,
  MagicStar,
  MenuBoard,
  Messages2,
  Monitor,
  Profile2User,
  ReceiptText,
  Routing,
  Send2,
  Setting2,
  Shop,
  ShoppingBag,
  TaskSquare,
  TickCircle,
  WalletMoney,
  Whatsapp
} from "@/components/ui/iconsax";
import type { Icon } from "@/components/ui/iconsax";

const metrics = [
  { label: "Today value", value: "INR 18,400.00", Icon: WalletMoney, tone: "bg-emerald/10 text-emerald" },
  { label: "Open orders", value: "27", Icon: ShoppingBag, tone: "bg-ocean/10 text-ocean" },
  { label: "Bookings", value: "14", Icon: CalendarTick, tone: "bg-violet/10 text-violet" },
  { label: "Repeat rate", value: "42%", Icon: Profile2User, tone: "bg-amber-100 text-amber-800" }
];

const lanes = [
  {
    title: "New",
    count: "8",
    accent: "bg-ocean",
    items: [
      ["VM-2048", "Meals combo x4", "UPI pending"],
      ["VM-2049", "Hair spa booking", "10:30 AM"]
    ]
  },
  {
    title: "Active",
    count: "12",
    accent: "bg-violet",
    items: [
      ["VM-2050", "Grocery essentials", "Packing"],
      ["VM-2051", "AC service visit", "Assigned"]
    ]
  },
  {
    title: "Ready",
    count: "7",
    accent: "bg-emerald",
    items: [
      ["VM-2052", "Filter coffee x3", "Paid"],
      ["VM-2053", "Laundry pickup", "Route set"]
    ]
  }
];

const businessModes = [
  { label: "Food", Icon: Shop },
  { label: "Retail", Icon: BagTick },
  { label: "Bookings", Icon: CalendarTick },
  { label: "Services", Icon: Setting2 }
];

const sidebarItems: {
  label: string;
  Icon: Icon;
  iconTone: string;
  activeClassName?: string;
}[] = [
  { label: "Operations", Icon: ShoppingBag, iconTone: "text-ocean", activeClassName: "bg-white text-ink shadow-sm" },
  { label: "Payments", Icon: Card, iconTone: "text-slate-400" },
  { label: "Customers", Icon: Profile2User, iconTone: "text-slate-400" },
  { label: "Reports", Icon: Chart2, iconTone: "text-slate-400" }
];

const automationSteps = [
  { label: "Customer intent", Icon: Messages2 },
  { label: "Catalog match", Icon: Category },
  { label: "Payment check", Icon: WalletMoney },
  { label: "Owner action", Icon: TaskSquare }
];

const phoneItems: { item: string; price: string; Icon: Icon }[] = [
  { item: "Meals combo", price: "149.00", Icon: MenuBoard },
  { item: "Cold coffee", price: "99.00", Icon: DirectboxNotif },
  { item: "Chocolate cake", price: "399.00", Icon: ReceiptText }
];

export default function HeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      return;
    }

    let cancelled = false;
    let cleanupAnimations = () => {};

    void import("animejs").then(({ animate, stagger }) => {
      if (cancelled) return;

      const loops = [
        animate(root.querySelectorAll("[data-float]"), {
          translateY: [-7, 7],
          rotate: [-0.35, 0.35],
          duration: 3200,
          delay: stagger(260),
          loop: true,
          alternate: true,
          ease: "inOutSine"
        }),
        animate(root.querySelectorAll("[data-progress]"), {
          scaleX: [0.24, 1],
          duration: 2600,
          delay: stagger(320),
          loop: true,
          alternate: true,
          ease: "inOutCubic"
        }),
        animate(root.querySelectorAll("[data-flow-card]"), {
          translateX: [-5, 5],
          duration: 2400,
          delay: stagger(210),
          loop: true,
          alternate: true,
          ease: "inOutSine"
        }),
        animate(root.querySelectorAll("[data-flow-node]"), {
          scale: [0.9, 1.08],
          opacity: [0.72, 1],
          duration: 1500,
          delay: stagger(180),
          loop: true,
          alternate: true,
          ease: "inOutSine"
        }),
        animate(root.querySelectorAll("[data-pulse]"), {
          opacity: [0.48, 1],
          scale: [0.96, 1.06],
          duration: 1500,
          delay: stagger(220),
          loop: true,
          alternate: true,
          ease: "inOutSine"
        })
      ];

      const pathLoops = Array.from(root.querySelectorAll<SVGPathElement>("[data-flow-path]")).map((path, index) => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        return animate(path, {
          strokeDashoffset: [length, 0],
          duration: 2100,
          delay: index * 180,
          loop: true,
          alternate: true,
          ease: "inOutSine"
        });
      });

      cleanupAnimations = () => {
        loops.forEach((animation) => animation.cancel());
        pathLoops.forEach((animation) => animation.cancel());
      };

      if (cancelled) {
        cleanupAnimations();
      }
    });

    return () => {
      cancelled = true;
      cleanupAnimations();
    };
  }, []);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(116deg,#eef4f8_0%,#f8fbff_42%,#ecf7f1_100%)]" />
      <div className="absolute inset-0 opacity-[0.34] [background-image:linear-gradient(rgba(13,19,33,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(13,19,33,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute inset-y-0 left-0 z-[1] hidden w-full bg-[linear-gradient(90deg,#eef4f8_0%,rgba(238,244,248,0.98)_34%,rgba(238,244,248,0.72)_48%,rgba(238,244,248,0)_67%)] lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,#eef4f8_0%,rgba(238,244,248,0)_100%)]" />

      <div className="absolute right-4 top-20 z-[1] w-[210px] opacity-35 sm:right-10 sm:w-[260px] lg:hidden">
        <AnimatedFlowMark />
      </div>

      <div className="absolute left-[55%] top-9 z-[2] hidden w-[700px] opacity-90 lg:block xl:left-[56%] xl:w-[790px] 2xl:left-[55%]">
        <DashboardWindow />
      </div>

      <div className="absolute bottom-8 right-6 z-[3] hidden w-[238px] lg:block xl:right-12 xl:w-[270px]">
        <CustomerPhone />
      </div>

      <div className="absolute bottom-8 left-[58%] z-[3] hidden w-[278px] lg:block xl:left-[57%] xl:w-[304px]">
        <BusinessModePanel />
      </div>

      <div className="absolute right-8 top-[13%] z-[1] hidden w-[340px] lg:block xl:right-14 xl:w-[380px]">
        <AnimatedFlowMark />
      </div>
    </div>
  );
}

function DashboardWindow() {
  return (
    <div data-hero-intro data-float className="overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-[0_34px_100px_rgba(18,70,160,0.2)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-line bg-slate-50/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-400" />
          <span className="size-2 rounded-full bg-amber-400" />
          <span className="size-2 rounded-full bg-emerald" />
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1 text-xs font-bold text-slate-600">
          <Monitor className="size-5 text-ocean" variant="Bulk" />
          Owner dashboard
        </span>
      </div>

      <div className="grid lg:grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-line bg-mist p-4 lg:block">
          <div className="rounded-lg bg-ink p-4 text-white">
            <p className="text-xs font-semibold text-white/60">Business</p>
            <p className="mt-1 font-bold">Sri Sai Local</p>
            <p data-pulse className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald/20 px-2.5 py-1 text-xs font-bold text-emerald">
              <TickCircle className="size-4" variant="Bold" />
              Open now
            </p>
          </div>
          <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
            {sidebarItems.map(({ label, Icon, iconTone, activeClassName = "" }) => (
              <div key={label} data-flow-card className={`flex items-center gap-2 rounded-lg px-3 py-2 ${activeClassName}`}>
                <Icon className={`size-5 ${iconTone}`} variant="Bulk" />
                {label}
              </div>
            ))}
          </div>
        </aside>

        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-emerald">Operations workspace</p>
              <h3 className="mt-1 text-xl font-extrabold text-ink">Orders, bookings, payments, and CRM</h3>
            </div>
            <span data-pulse className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald/10 px-3 py-2 text-xs font-bold text-emerald">
              <Whatsapp className="size-5" variant="Bulk" />
              WhatsApp ready
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {metrics.map(({ label, value, tone, Icon }) => (
              <div key={label} data-hero-intro className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <div className={`mb-3 grid size-10 place-items-center rounded-lg ${tone}`}>
                  <Icon className="size-5" variant="Bulk" />
                </div>
                <p className="text-lg font-extrabold text-ink">{value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span data-progress data-hero-line className="block h-full origin-left rounded-full bg-current text-emerald" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_260px]">
            <div className="grid gap-3 md:grid-cols-3">
              {lanes.map((lane) => (
                <div key={lane.title} data-hero-intro className="rounded-lg border border-line bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${lane.accent}`} />
                      <h4 className="font-bold text-ink">{lane.title}</h4>
                    </div>
                    <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-slate-600">{lane.count}</span>
                  </div>
                  <div className="space-y-2">
                    {lane.items.map(([id, item, status], index) => (
                      <div key={id} data-flow-card className="rounded-lg bg-mist p-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-ink">{id}</span>
                          <span className="rounded-full bg-white px-2 py-1 font-bold text-ocean">{status}</span>
                        </div>
                        <p className="mt-2 truncate font-semibold text-slate-600">{item}</p>
                        {index === 0 && (
                          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white">
                            <span data-progress data-hero-line className={`block h-full origin-left rounded-full ${lane.accent}`} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div data-hero-intro className="rounded-lg border border-line bg-mist p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <MagicStar className="size-6 text-ocean" variant="Bulk" />
                <h4 className="font-bold text-ink">Next best action</h4>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Send a lunch reminder to 124 opted-in customers who ordered in the last 30 days.
              </p>
              <div className="mt-4 grid gap-2">
                {automationSteps.map(({ label, Icon }) => (
                  <div key={label} data-flow-card className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink">
                    <Icon className="size-5 text-emerald" variant="Bulk" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerPhone() {
  return (
    <div data-hero-intro data-float className="rounded-[2rem] border border-ink/10 bg-ink p-2 shadow-[0_28px_90px_rgba(13,19,33,0.3)]">
      <div className="overflow-hidden rounded-[1.55rem] bg-white">
        <div className="bg-ink px-4 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/60">Customer flow</p>
              <p className="mt-1 font-bold">Fresh Bowl</p>
            </div>
            <span data-pulse className="inline-flex items-center gap-1 rounded-full bg-emerald px-2.5 py-1 text-xs font-bold">
              <Whatsapp className="size-4" variant="Bold" />
              Open
            </span>
          </div>
          <div className="mt-4 flex gap-2 text-xs text-white/80">
            <span className="rounded-full bg-white/10 px-2 py-1">Pickup</span>
            <span className="rounded-full bg-white/10 px-2 py-1">UPI</span>
            <span className="rounded-full bg-white/10 px-2 py-1">WhatsApp</span>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {phoneItems.map(({ item, price, Icon }) => (
            <div key={item} data-flow-card className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-mist text-ocean">
                  <Icon className="size-5" variant="Bulk" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{item}</p>
                  <p className="text-xs text-slate-500">Ready today</p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-ink">INR {price}</span>
            </div>
          ))}
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-bold text-white" tabIndex={-1}>
            <Send2 className="size-5" variant="Bold" />
            Send on WhatsApp
          </button>
          <div className="grid grid-cols-3 gap-2">
            {["Paid", "Accepted", "Ready"].map((label) => (
              <div key={label} data-pulse className="rounded-lg bg-emerald/10 px-2 py-2 text-center text-[11px] font-bold text-emerald">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessModePanel() {
  return (
    <div data-hero-intro data-float className="rounded-lg border border-white/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(18,70,160,0.18)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Location className="size-6 text-emerald" variant="Bulk" />
          <p className="font-bold text-ink">Setup adapts</p>
        </div>
        <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-slate-600">Multi-category</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {businessModes.map(({ label, Icon }) => (
          <div key={label} data-flow-card className="rounded-lg border border-line bg-mist p-3">
            <Icon className="size-5 text-ocean" variant="Bulk" />
            <p className="mt-2 text-xs font-bold text-slate-700">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimatedFlowMark() {
  return (
    <div data-hero-intro data-float className="relative aspect-[1.15] w-full">
      <svg viewBox="0 0 420 360" role="img" className="size-full overflow-visible">
        <defs>
          <linearGradient id="flowStroke" x1="44" x2="370" y1="60" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1246a0" />
            <stop offset="0.52" stopColor="#6c3df4" />
            <stop offset="1" stopColor="#11a66a" />
          </linearGradient>
          <filter id="flowShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" floodColor="#1246a0" floodOpacity="0.18" stdDeviation="16" />
          </filter>
        </defs>
        <path data-flow-path d="M54 172C92 74 173 65 211 143C250 223 322 219 369 118" fill="none" stroke="url(#flowStroke)" strokeLinecap="round" strokeWidth="8" />
        <path data-flow-path d="M58 246C128 193 192 198 236 257C276 309 339 299 380 238" fill="none" stroke="url(#flowStroke)" strokeLinecap="round" strokeOpacity="0.56" strokeWidth="5" />
        <g filter="url(#flowShadow)">
          <FlowNode x={50} y={172} icon={<Messages2 className="size-7" variant="Bulk" />} />
          <FlowNode x={210} y={143} icon={<WalletMoney className="size-7" variant="Bulk" />} />
          <FlowNode x={369} y={118} icon={<ChartSuccess className="size-7" variant="Bulk" />} />
          <FlowNode x={236} y={257} icon={<Routing className="size-7" variant="Bulk" />} />
        </g>
      </svg>
    </div>
  );
}

function FlowNode({ x, y, icon }: { x: number; y: number; icon: ReactNode }) {
  return (
    <foreignObject x={x - 30} y={y - 30} width="60" height="60">
      <div data-flow-node className="grid size-[60px] place-items-center rounded-lg border border-white/80 bg-white text-ocean shadow-[0_18px_50px_rgba(18,70,160,0.18)]">
        {icon}
      </div>
    </foreignObject>
  );
}
