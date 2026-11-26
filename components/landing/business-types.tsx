import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  BowlIllustration,
  CakeIllustration,
  CalendarIllustration,
  GroceryIllustration,
  JuiceIllustration,
  SalonIllustration,
  TiffinIllustration,
  type IllustrationProps
} from "@/components/illustrations/clay-illustrations";
import { HorizontalScroll } from "@/components/motion/horizontal-scroll";
import { Sticker } from "@/components/ui/sticker";
import { businessServiceTypeOptions } from "@/lib/business-service-types";
import { cn } from "@/lib/utils";

const types: Array<{
  name: string;
  note: string;
  Art: ComponentType<IllustrationProps>;
  tint: string;
  sticker?: string;
}> = [
  { name: "Tiffin centers", note: "Daily meals and monthly plans", Art: TiffinIllustration, tint: "clay-tint-marigold", sticker: "Pilot focus" },
  { name: "Restaurants", note: "Menu, orders and delivery", Art: BowlIllustration, tint: "clay-tint-kumkum" },
  { name: "Home bakers", note: "Pre-orders for every cake", Art: CakeIllustration, tint: "clay-tint-peacock" },
  { name: "Juice and cafes", note: "Quick takeaway orders", Art: JuiceIllustration, tint: "clay-tint-peacock" },
  { name: "Salon and spa", note: "Bookings and reminders", Art: SalonIllustration, tint: "clay-tint-ivory" },
  { name: "Grocery and kirana", note: "Repeat baskets on WhatsApp", Art: GroceryIllustration, tint: "clay-tint-green" },
  { name: "Home services", note: "Laundry, tailoring, repairs", Art: CalendarIllustration, tint: "clay-tint-marigold" }
];

/** Business types as big clay cards; the row slides sideways as the page scrolls (desktop). */
export function BusinessTypes() {
  return (
    <HorizontalScroll
      className="py-16 lg:py-0"
      header={
        <div className="mx-auto mb-8 flex w-full max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <p className="inline-flex rounded-full bg-peacock-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-peacock-700">
              Who it is for
            </p>
            <h2 id="businesses" className="mt-3 scroll-mt-24 text-[clamp(1.9rem,4.4vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink">
              Made for every local shop
            </h2>
          </div>
          <p className="text-sm font-bold text-ink-500">
            {businessServiceTypeOptions.length} business types supported <span className="hidden lg:inline">· keep scrolling</span>
            <span className="lg:hidden">· swipe</span>
          </p>
        </div>
      }
    >
      {types.map(({ name, note, Art, tint, sticker }, index) => (
        <article
          key={name}
          className={cn(
            "clay relative flex h-[22rem] w-[16.5rem] shrink-0 snap-start flex-col rounded-[2rem] p-5 sm:h-[24rem] sm:w-[19rem] lg:h-[26rem] lg:w-[21rem]",
            tint
          )}
        >
          {sticker && (
            <div className="absolute right-4 top-4 z-10">
              <Sticker tone="green" tilt={6}>
                {sticker}
              </Sticker>
            </div>
          )}
          <span className="text-xs font-extrabold text-ink-500">0{index + 1}</span>
          <div className="flex flex-1 items-center justify-center">
            <Art className="w-[78%] drop-shadow-[0_18px_22px_rgba(84,58,18,0.12)]" />
          </div>
          <h3 className="text-xl font-extrabold tracking-[-0.02em] text-ink">{name}</h3>
          <p className="mt-1 text-sm font-semibold text-ink-500">{note}</p>
        </article>
      ))}
      <Link
        href="/register?plan=STARTER"
        className="group relative flex h-[22rem] w-[16.5rem] shrink-0 snap-start flex-col justify-between rounded-[2rem] bg-clay-ink p-6 text-white shadow-clay-lg transition-transform hover:-translate-y-1 sm:h-[24rem] sm:w-[19rem] lg:h-[26rem] lg:w-[21rem] theme-dark"
        data-marketing-event="cta_click"
        data-marketing-location="business_types"
        data-marketing-label="submit_your_business"
        data-marketing-destination="/register?plan=STARTER"
      >
        <Sticker tone="marigold" tilt={-6} className="self-start">
          + {Math.max(0, businessServiceTypeOptions.length - types.length)} more
        </Sticker>
        <div>
          <p className="text-2xl font-extrabold leading-tight tracking-[-0.03em]">Your business is next.</p>
          <p className="mt-2 text-sm font-semibold text-white/70">Pharmacy, fitness, catering and more.</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-clay-green px-4 py-3 text-sm font-extrabold shadow-clay-sm">
            Register your shop <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </HorizontalScroll>
  );
}
