import type { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

const toneStyles = {
  ink: { orb: "bg-clay-ink text-brand theme-dark", glow: "from-ivory-100" },
  green: { orb: "bg-clay-green text-ink", glow: "from-green-50" },
  peacock: { orb: "bg-clay-peacock text-white", glow: "from-peacock-50" },
  marigold: { orb: "bg-clay-marigold text-ink", glow: "from-marigold-50" },
  kumkum: { orb: "bg-clay-kumkum text-white", glow: "from-kumkum-50" }
} as const;

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "ink",
  density = "regular"
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
  density?: "regular" | "compact";
}) {
  const style = toneStyles[tone];
  const compact = density === "compact";

  return (
    <Card
      className={cn(
        "relative min-w-0 overflow-hidden bg-gradient-to-br to-white to-60%",
        style.glow,
        compact ? "min-h-[6.75rem] p-3.5 sm:p-4" : "min-h-[7.75rem] p-4 sm:p-5"
      )}
    >
      <div className={cn("flex min-w-0 items-start justify-between", compact ? "gap-2.5" : "gap-3")}>
        <div className="min-w-0">
          <p className={cn("font-bold text-ink-500", compact ? "text-xs leading-5 sm:text-[13px]" : "text-[13px] leading-5 sm:text-sm")}>{title}</p>
          <p className={cn("break-words font-display font-bold leading-tight tracking-[-0.03em] text-ink", compact ? "mt-1.5 text-xl" : "mt-2 text-[1.75rem]")}>{value}</p>
          <p className={cn("break-words text-ink-500", compact ? "mt-1 text-xs leading-5 sm:text-[13px]" : "mt-1.5 text-sm leading-5")}>{detail}</p>
        </div>
        <div className={cn("clay-orb shrink-0", style.orb, compact ? "size-10 rounded-[0.9rem]" : "size-12")}>
          <Icon className={compact ? "size-[18px]" : "size-[22px]"} strokeWidth={2.2} />
        </div>
      </div>
    </Card>
  );
}
