"use client";

import { Bell, Check } from "lucide-react";
import {
  BellIllustration,
  BowlIllustration,
  ShopIllustration,
  UpiQrIllustration
} from "@/components/illustrations/clay-illustrations";
import { Parallax } from "@/components/motion/parallax";
import { TiltStage } from "@/components/motion/tilt-stage";
import { Sticker } from "@/components/ui/sticker";
import { PhoneMockup, ShopScreen } from "./phone-mockup";

/**
 * Hero picture: a clay phone on a soft podium with 3D objects and glass toasts around it.
 * Each object rides its own scroll speed (anchored to the page top, so nothing moves
 * until the visitor scrolls) and the whole stage tilts toward a mouse pointer.
 */
export function HeroStage() {
  return (
    <TiltStage className="relative mx-auto aspect-square w-full max-w-[25rem] sm:max-w-[32rem] lg:max-w-[36rem]">
      <div aria-hidden="true" className="vm-blob left-[4%] top-[10%] size-[58%] bg-violet motion-safe:animate-blob-drift" />
      <div aria-hidden="true" className="vm-blob bottom-[6%] right-[2%] size-[52%] bg-emerald motion-safe:animate-blob-drift [animation-delay:-6s]" />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 size-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_28%,#ffffff_0%,#f3f0ff_48%,#e6e0fb_100%)] shadow-[0_50px_90px_-40px_rgba(55,41,130,0.45),inset_0_-18px_40px_rgba(124,92,255,0.12),inset_0_10px_24px_rgba(255,255,255,0.95)]"
      />
      <div aria-hidden="true" className="dotted-grid absolute inset-[10%] rounded-full opacity-60 [mask-image:radial-gradient(circle,black_30%,transparent_70%)]" />

      {/* Positioning lives on the wrapper: Parallax writes its own inline transform. */}
      <div className="absolute left-1/2 top-[7%] z-10 w-[44%] -translate-x-1/2">
        <Parallax anchor="top" speed={-0.08}>
          <PhoneMockup>
            <ShopScreen />
          </PhoneMockup>
        </Parallax>
      </div>

      <Parallax anchor="top" speed={-0.32} rotate={-6} className="absolute left-[-3%] top-[2%] z-0 w-[34%]">
        <div className="motion-safe:animate-float-slow">
          <ShopIllustration title="Shop" />
        </div>
      </Parallax>

      <Parallax anchor="top" speed={-0.5} rotate={10} className="absolute right-[-4%] top-[34%] z-20 w-[31%]">
        <div className="motion-safe:animate-float [animation-delay:-2s]">
          <UpiQrIllustration />
        </div>
      </Parallax>

      <Parallax anchor="top" speed={-0.62} rotate={-12} className="absolute right-[6%] top-[0%] z-0 w-[19%]">
        <div className="motion-safe:animate-float-tilt">
          <BellIllustration />
        </div>
      </Parallax>

      <Parallax anchor="top" speed={-0.2} className="absolute bottom-[3%] left-[1%] z-20 w-[27%]">
        <div className="motion-safe:animate-float-slow [animation-delay:-4s]">
          <BowlIllustration />
        </div>
      </Parallax>

      <Parallax anchor="top" speed={-0.4} className="absolute left-[-6%] top-[47%] z-30 hidden min-[420px]:block">
        <div className="glass flex items-center gap-2.5 rounded-2xl py-2 pl-2 pr-3.5 motion-safe:animate-float [animation-delay:-1s]">
          <span className="clay-orb size-9 rounded-xl bg-clay-emerald text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="leading-tight">
            <span className="block text-[11px] font-bold text-slate-500">UPI received</span>
            <span className="block text-sm font-extrabold text-ink">₹120.00</span>
          </span>
        </div>
      </Parallax>

      <Parallax anchor="top" speed={-0.26} className="absolute bottom-[13%] right-[-2%] z-30 hidden min-[420px]:block">
        <div className="glass flex items-center gap-2.5 rounded-2xl py-2 pl-2 pr-3.5 motion-safe:animate-float-slow [animation-delay:-3s]">
          <span className="clay-orb size-9 rounded-xl bg-clay-mango text-ink">
            <Bell className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-[11px] font-bold text-slate-500">New order</span>
            <span className="block text-sm font-extrabold text-ink">#VM-2051</span>
          </span>
        </div>
      </Parallax>

      <div className="absolute left-[16%] top-[30%] z-30">
        <Sticker tone="berry" tilt={-10}>Live</Sticker>
      </div>
    </TiltStage>
  );
}
