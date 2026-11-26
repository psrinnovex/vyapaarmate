import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StickerTone = "marigold" | "green" | "ink" | "paper" | "peacock" | "kumkum";

const toneClass: Record<StickerTone, string> = {
  marigold: "bg-marigold-500 text-ink",
  green: "bg-brand text-on-brand",
  ink: "bg-ink text-white theme-dark",
  paper: "bg-white text-ink",
  peacock: "bg-peacock-600 text-white",
  kumkum: "bg-kumkum-700 text-white"
};

/**
 * Price-tag sticker: a notched tag with a punched hole, bold caps and an optional tilt in
 * degrees. Marigold is for offers and eyebrows; use at most two per screen.
 */
export function Sticker({
  tone = "marigold",
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
