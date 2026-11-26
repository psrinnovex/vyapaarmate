"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Shop } from "@/components/ui/iconsax";
import { getBusinessHoursSummary, getBusinessTime } from "@/lib/business-hours";
import { cn } from "@/lib/utils";

type BusinessHoursDisclosureProps = {
  businessId: string;
  hours: string;
  open: boolean;
  now: Date;
  showSchedule?: boolean;
  showSummary?: boolean;
  variant?: "card" | "hero";
  leadingIcon?: ReactNode;
  className?: string;
};

export function BusinessHoursDisclosure({
  businessId,
  hours,
  open,
  now,
  showSchedule = true,
  showSummary = true,
  variant = "card",
  leadingIcon,
  className
}: BusinessHoursDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => getBusinessHoursSummary(hours, open, now), [hours, open, now]);
  const { schedule, primary, secondary } = summary;
  const panelId = `business-days-${businessId}`;
  const currentDayIndex = getBusinessTime(now).dayIndex;
  const isHero = variant === "hero";
  const icon = leadingIcon ?? <Shop className="mt-0.5 size-5 shrink-0 text-brand-text" variant="Bulk" />;

  const toggleButton = schedule && showSchedule ? (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={() => setExpanded((current) => !current)}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition focus:outline-none focus:ring-2",
        isHero
          ? "border-white/20 bg-white/10 text-white/80 backdrop-blur hover:border-brand/30 hover:bg-brand/20 hover:text-white focus:ring-brand/30"
          : "border-ink-200 bg-white text-ink-600 hover:border-green-700/30 hover:text-brand-text focus:ring-green-700/20"
      )}
    >
      <span>{expanded ? "Hide business days" : "Show business days"}</span>
      <ChevronDown className={cn("size-4 stroke-[2.5] transition-transform duration-300", expanded && "rotate-180")} />
    </button>
  ) : null;

  const schedulePanel = schedule && showSchedule ? (
    <div
      id={panelId}
      aria-hidden={!expanded}
      className={cn(
        "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        expanded ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={cn("overflow-hidden rounded-lg border", isHero ? "border-white/15 bg-white/10 backdrop-blur" : "border-ink-200 bg-ivory-100/60")}>
          {schedule.map((row, rowIndex) => (
            <div
              key={row.key}
              className={cn(
                "grid grid-cols-[4rem_1fr] gap-3 border-b px-3 py-2 text-xs font-semibold last:border-b-0",
                isHero ? "border-white/10 text-white/75" : "border-ink-200/70 text-ink-600",
                rowIndex === currentDayIndex && (isHero ? "bg-brand/15 text-white" : "bg-brand/10 text-ink")
              )}
            >
              <span className={rowIndex === currentDayIndex ? "font-extrabold" : "font-bold"}>{row.label}</span>
              <span className="min-w-0">{row.rangeLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (!showSummary) {
    return (
      <div className={cn("grid gap-2", className)}>
        <div className="flex items-start gap-2">
          {icon}
          <div className="min-w-0 flex-1">
            {toggleButton ?? <p className={cn("text-sm font-semibold leading-6", isHero ? "text-white/70" : "text-ink-600")}>{primary}</p>}
          </div>
        </div>
        {schedulePanel && <div className="max-w-xl pl-6">{schedulePanel}</div>}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold leading-5", isHero ? "text-green-100" : "text-green-700")}>{primary}</p>
          {secondary && <p className={cn("mt-0.5 text-xs font-semibold leading-5", isHero ? "text-green-200/85" : "text-green-600")}>{secondary}</p>}
        </div>
      </div>

      {toggleButton && (
        <div className="pl-7">
          {toggleButton}
          {schedulePanel}
        </div>
      )}
    </div>
  );
}
