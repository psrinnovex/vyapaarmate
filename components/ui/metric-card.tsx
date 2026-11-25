import type { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

const toneStyles = {
  blue: { orb: "bg-clay-ocean", glow: "from-ocean/12" },
  emerald: { orb: "bg-clay-emerald", glow: "from-emerald/12" },
  purple: { orb: "bg-clay-violet", glow: "from-violet/12" },
  amber: { orb: "bg-clay-mango", glow: "from-mango/15" },
  red: { orb: "bg-clay-berry", glow: "from-berry/12" }
} as const;

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "blue",
  density = "regular"
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "blue" | "emerald" | "purple" | "amber" | "red";
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
          <p className={cn("font-bold text-slate-500", compact ? "text-xs leading-5 sm:text-[13px]" : "text-[13px] leading-5 sm:text-sm")}>{title}</p>
          <p className={cn("break-words font-extrabold leading-tight tracking-[-0.03em] text-ink", compact ? "mt-1.5 text-xl" : "mt-2 text-[1.75rem]")}>{value}</p>
          <p className={cn("break-words text-slate-500", compact ? "mt-1 text-xs leading-5 sm:text-[13px]" : "mt-1.5 text-sm leading-5")}>{detail}</p>
        </div>
        <div className={cn("clay-orb shrink-0 text-white", style.orb, compact ? "size-10 rounded-[0.9rem]" : "size-12")}>
          <Icon className={compact ? "size-[18px]" : "size-[22px]"} strokeWidth={2.2} />
        </div>
      </div>
    </Card>
  );
}
