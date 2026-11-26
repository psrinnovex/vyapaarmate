import type { ReactNode } from "react";
import { Bell, Check, CheckCheck, ChevronLeft, Clock, MapPin, Minus, Plus, QrCode, Star, Store } from "lucide-react";
import { BowlIllustration, JuiceIllustration, TiffinIllustration } from "@/components/illustrations/clay-illustrations";
import { cn } from "@/lib/utils";

/** Clay phone frame used across the website; screens below are illustrative UI, not live data. */
export function PhoneMockup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[9/19] w-full rounded-[2.75rem] bg-clay-ink p-[0.6rem] shadow-[0_40px_80px_-30px_rgba(11,13,11,0.55),0_18px_36px_-18px_rgba(11,13,11,0.35),inset_0_2px_3px_rgba(255,255,255,0.25)] theme-dark",
        className
      )}
    >
      <span aria-hidden="true" className="absolute -left-[3px] top-[18%] h-10 w-[3px] rounded-l bg-[#262a25]" />
      <span aria-hidden="true" className="absolute -right-[3px] top-[24%] h-14 w-[3px] rounded-r bg-[#262a25]" />
      <div className="vm-phone-screen relative h-full overflow-hidden rounded-[2.2rem] bg-[#faf7f0]">
        <span aria-hidden="true" className="absolute left-1/2 top-2 z-20 h-[1.15rem] w-[34%] -translate-x-1/2 rounded-full bg-[#0b0d0b]" />
        {/* Screens are drawn for a ~250px phone; .vm-phone-zoom shrinks them on smaller phones (CSS only, no layout flash). */}
        <div className="vm-phone-zoom relative h-full">{children}</div>
      </div>
    </div>
  );
}

const menu = [
  { name: "Idli Vada", price: 60, qty: 2, Art: TiffinIllustration, tint: "bg-marigold-50" },
  { name: "Mini Meals", price: 120, qty: 0, Art: BowlIllustration, tint: "bg-kumkum-50" },
  { name: "Mango Lassi", price: 50, qty: 0, Art: JuiceIllustration, tint: "bg-peacock-50" }
];

/** Customer view of a shop's order page. */
export function ShopScreen() {
  return (
    <div className="flex h-full flex-col text-ink">
      <div className="relative bg-clay-green px-4 pb-6 pt-9 text-ink">
        <div className="flex items-center justify-between text-[10px] font-bold opacity-90">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> Jayanagar
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
            <Clock className="size-3" /> 20 min
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-white text-brand-text shadow-clay-sm">
            <Store className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold leading-tight">Lakshmi Tiffins</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-ink/75">
              <Star className="size-3 fill-current" /> 4.8 · South Indian
            </p>
          </div>
        </div>
      </div>
      <div className="relative z-10 -mt-3 flex gap-1.5 px-3">
        {["Breakfast", "Meals", "Drinks"].map((chip, index) => (
          <span
            key={chip}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-extrabold shadow-clay-sm",
              index === 0 ? "bg-ink text-white theme-dark" : "bg-white text-ink-600"
            )}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-3 flex-1 space-y-2 px-3">
        {menu.map(({ name, price, qty, Art, tint }) => (
          <div key={name} className="flex items-center gap-2.5 rounded-2xl bg-white p-2 shadow-clay-sm">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tint)}>
              <Art className="w-9" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-extrabold">{name}</p>
              <p className="text-[11px] font-bold text-ink-500">₹{price}</p>
            </div>
            {qty ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-1.5 py-1 text-[10px] font-extrabold text-green-700">
                <Minus className="size-3" />
                {qty}
                <Plus className="size-3" />
              </span>
            ) : (
              <span className="grid size-6 place-items-center rounded-full bg-clay-green text-ink shadow-clay-sm">
                <Plus className="size-3.5" />
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="m-3 flex items-center justify-between rounded-2xl bg-clay-ink px-3 py-2.5 text-white shadow-clay theme-dark">
        <span className="text-[10px] font-bold text-white/75">2 items</span>
        <span className="text-[13px] font-extrabold">₹120</span>
        <span className="rounded-xl bg-clay-green px-2.5 py-1 text-[10px] font-extrabold">Pay by UPI</span>
      </div>
    </div>
  );
}

/** UPI payment step. `paid` flips the status chip to the success state. */
export function PayScreen({ paid = false }: { paid?: boolean }) {
  const cells = [0, 2, 3, 5, 7, 8, 11, 12, 14, 17, 19, 20, 22, 23, 26, 28, 29, 31, 33, 34];
  return (
    <div className="flex h-full flex-col items-center px-4 pb-4 pt-10 text-ink">
      <div className="flex w-full items-center gap-2 text-[11px] font-bold text-ink-500">
        <ChevronLeft className="size-4" /> Lakshmi Tiffins
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Pay</p>
      <p className="text-[2rem] font-extrabold leading-none tracking-[-0.04em]">₹120</p>
      <div className="relative mt-4 rounded-[1.4rem] bg-white p-3 shadow-clay">
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 36 }).map((_, index) => (
            <span key={index} className={cn("size-3.5 rounded-[4px]", cells.includes(index) ? "bg-ink" : "bg-ivory-100")} />
          ))}
        </div>
        <span className="absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-clay-peacock text-white shadow-clay-sm">
          <QrCode className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-[10px] font-bold text-ink-500">Scan with any UPI app</p>
      <div className="mt-auto w-full">
        <div
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[12px] font-extrabold shadow-clay transition-colors duration-500",
            paid ? "bg-clay-green text-ink" : "bg-white text-ink-600"
          )}
        >
          {paid ? (
            <>
              <span className="grid size-5 place-items-center rounded-full bg-white text-brand-text">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              Paid · ₹120
            </>
          ) : (
            <>
              <span className="size-2 animate-pulse rounded-full bg-marigold-500" />
              Waiting for payment
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** WhatsApp-style confirmation thread. */
export function WhatsAppScreen() {
  return (
    <div className="flex h-full flex-col bg-[#efeae2] text-ink">
      <div className="flex items-center gap-2 bg-[#0b7d49] px-3 pb-3 pt-9 text-white">
        <ChevronLeft className="size-4" />
        <span className="grid size-8 place-items-center rounded-full bg-white text-brand-text">
          <Store className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-extrabold leading-tight">Lakshmi Tiffins</p>
          <p className="text-[9px] font-semibold text-white/75">Business account</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 px-3 py-3">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-2.5 py-2 text-[10.5px] font-semibold shadow-sm">
          2 idli vada please
          <span className="mt-0.5 flex items-center justify-end gap-0.5 text-[8.5px] text-ink-500">
            8:02 <CheckCheck className="size-3 text-peacock-600" />
          </span>
        </div>
        <div className="max-w-[88%] overflow-hidden rounded-2xl rounded-tl-md bg-white text-[10.5px] shadow-sm">
          <div className="bg-clay-green px-2.5 py-2 text-ink">
            <p className="flex items-center gap-1 text-[11px] font-extrabold">
              <Check className="size-3.5" strokeWidth={3} /> Order confirmed
            </p>
            <p className="text-[9.5px] font-semibold text-ink/75">#VM-2051 · ₹120 paid by UPI</p>
          </div>
          <div className="px-2.5 py-2 font-semibold text-ink-600">
            Ready in <b className="text-ink">20 min</b>. We will message you when it leaves.
          </div>
          <div className="border-t border-ink-200 py-1.5 text-center text-[10px] font-extrabold text-brand-text">Track order</div>
        </div>
        <div className="max-w-[70%] rounded-2xl rounded-tl-md bg-white px-2.5 py-2 text-[10.5px] font-semibold shadow-sm">
          <span className="inline-flex items-center gap-1 font-extrabold text-green-700">
            <Bell className="size-3" /> Out for delivery
          </span>
        </div>
      </div>
      <div className="mx-3 mb-3 rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-ink-500 shadow-sm">Message</div>
    </div>
  );
}
