import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StickerTone = "emerald" | "mango" | "berry" | "violet" | "ocean" | "sky" | "ink" | "white";

const toneClass: Record<StickerTone, string> = {
  emerald: "bg-clay-emerald text-white",
  mango: "bg-clay-mango text-ink",
  berry: "bg-clay-berry text-white",
  violet: "bg-clay-violet text-white",
  ocean: "bg-clay-ocean text-white",
  sky: "bg-[linear-gradient(180deg,#9be0ff_0%,#33b5f5_100%)] text-ink",
  ink: "bg-clay-ink text-white",
  white: "bg-white text-ink"
};

/** Die-cut "sticker" label: thick white edge, bold caps, optional tilt in degrees. */
export function Sticker({
  tone = "mango",
  tilt = 0,
  icon,
  className,
  children
}: {
  tone?: StickerTone;
  tilt?: number;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("sticker", toneClass[tone], className)} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      {icon}
      {children}
    </span>
  );
}
