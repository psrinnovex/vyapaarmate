import type { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

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
  const toneClass = {
    blue: "bg-ocean/10 text-ocean",
    emerald: "bg-emerald/10 text-emerald",
    purple: "bg-violet/10 text-violet",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-50 text-red-700"
  }[tone];
  const compact = density === "compact";

  return (
    <Card className={cn("min-w-0 overflow-hidden", compact ? "min-h-[6.75rem] p-3.5 sm:p-4" : "min-h-[7.5rem] p-4 sm:p-5")}>
      <div className={cn("flex min-w-0 items-start justify-between", compact ? "gap-2.5" : "gap-3")}>
        <div className="min-w-0">
          <p className={cn("font-semibold text-slate-500", compact ? "text-xs leading-5 sm:text-[13px]" : "text-[13px] leading-5 sm:text-sm")}>{title}</p>
          <p className={cn("break-words font-bold leading-tight text-ink", compact ? "mt-2 text-xl" : "mt-3 text-2xl")}>{value}</p>
          <p className={cn("break-words text-slate-500", compact ? "mt-1.5 text-xs leading-5 sm:text-[13px]" : "mt-2 text-sm leading-5")}>{detail}</p>
        </div>
        <div className={cn("grid shrink-0 place-items-center rounded-lg", compact ? "size-9" : "size-11", toneClass)}>
          <Icon className={compact ? "size-4" : "size-5"} />
        </div>
      </div>
    </Card>
  );
}
