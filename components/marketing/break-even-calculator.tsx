"use client";

import { useId, useState } from "react";
import { pricingPlans } from "@/lib/constants";
import { cn } from "@/lib/utils";

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

/**
 * Slide your profit per order and see how many direct orders cover each plan's monthly fee.
 * Plain arithmetic on the plan price only — GST, setup and provider charges are excluded.
 */
export function BreakEvenCalculator() {
  const id = useId();
  const [margin, setMargin] = useState(40);

  return (
    <div className="rounded-[1.75rem] bg-white/10 p-5 ring-1 ring-white/15 sm:p-6">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm font-bold text-white/80">
        Your profit on one order
        <span className="text-3xl font-extrabold tracking-[-0.04em] text-white">{rupees(margin)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={10}
        max={300}
        step={5}
        value={margin}
        onChange={(event) => setMargin(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-green-400"
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {pricingPlans.map((plan) => {
          const perMonth = Math.ceil(plan.price / margin);
          const perDay = Math.max(1, Math.ceil(perMonth / 30));
          return (
            <div key={plan.id} className={cn("rounded-[1.4rem] p-4", plan.id === "PRO" ? "bg-brand text-ink" : "bg-white text-ink")}>
              <p className={cn("text-xs font-extrabold uppercase tracking-[0.08em]", plan.id === "PRO" ? "text-white/75" : "text-ink-500")}>{plan.name}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-[-0.04em]" aria-live="polite">
                {perMonth} <span className="text-base font-bold">orders / month</span>
              </p>
              <p className={cn("mt-0.5 text-sm font-bold", plan.id === "PRO" ? "text-white/80" : "text-ink-500")}>
                about {perDay} a day covers {rupees(plan.price)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs font-semibold leading-5 text-white/55">Plan fee only. Add GST, setup, gateway, WhatsApp and other provider costs to your own calculation.</p>
    </div>
  );
}
