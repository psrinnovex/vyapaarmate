import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type StatusSwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  loading?: boolean;
  checkedLabel?: string;
  uncheckedLabel?: string;
  showLabel?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function StatusSwitch({
  checked,
  loading = false,
  checkedLabel = "Active",
  uncheckedLabel = "Inactive",
  showLabel = true,
  onCheckedChange,
  disabled,
  className,
  onClick,
  "aria-label": ariaLabel,
  ...props
}: StatusSwitchProps) {
  const label = checked ? checkedLabel : uncheckedLabel;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled || loading}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      className={cn(
        "inline-flex h-10 items-center justify-end rounded-lg p-1 text-sm font-semibold transition duration-200",
        showLabel && "gap-2 pr-3",
        "focus:outline-none focus:ring-4 focus:ring-ocean/10 disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "text-emerald hover:bg-emerald/10" : "text-slate-600 hover:bg-slate-100",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border p-1 transition-all duration-300 ease-out",
          checked ? "border-emerald/30 bg-emerald shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)]" : "border-slate-300 bg-slate-200",
          loading && "animate-pulse"
        )}
      >
        <span
          className={cn(
            "absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-white shadow-md transition-transform duration-300 ease-out",
            checked ? "translate-x-8" : "translate-x-0"
          )}
        >
          {loading ? (
            <span className="size-3 rounded-full border-2 border-slate-300 border-t-ink animate-spin" />
          ) : (
            <span className={cn("size-2 rounded-full transition-colors duration-300", checked ? "bg-emerald" : "bg-slate-400")} />
          )}
        </span>
        <span className={cn("absolute left-2.5 size-1.5 rounded-full bg-white/75 transition-opacity duration-300", checked ? "opacity-100" : "opacity-0")} />
        <span className={cn("absolute right-2.5 size-1.5 rounded-full bg-slate-400 transition-opacity duration-300", checked ? "opacity-0" : "opacity-100")} />
      </span>
      {showLabel && <span className="min-w-[4.25rem] text-left">{loading ? "Saving" : label}</span>}
    </button>
  );
}
