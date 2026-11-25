import { cn } from "@/lib/utils";

const statusClasses: Record<string, string> = {
  NEW: "bg-ocean-soft text-ocean-deep border-ocean/15",
  ACCEPTED: "bg-violet-soft text-violet-deep border-violet/20",
  PREPARING: "bg-mango-soft text-mango-deep border-mango/30",
  READY: "bg-emerald-soft text-emerald-deep border-emerald/20",
  DELIVERED: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-berry-soft text-berry-deep border-berry/25",
  PENDING: "bg-mango-soft text-mango-deep border-mango/30",
  COMPLETED: "bg-emerald-soft text-emerald-deep border-emerald/20",
  FAILED: "bg-berry-soft text-berry-deep border-berry/25",
  REFUNDED: "bg-violet-soft text-violet-deep border-violet/20",
  ACTIVE: "bg-emerald-soft text-emerald-deep border-emerald/20",
  TRIAL: "bg-violet-soft text-violet-deep border-violet/20",
  PAST_DUE: "bg-mango-soft text-mango-deep border-mango/30",
  Active: "bg-emerald-soft text-emerald-deep border-emerald/20",
  Trial: "bg-violet-soft text-violet-deep border-violet/20",
  Inactive: "bg-slate-100 text-slate-700 border-slate-200",
  Suspended: "bg-berry-soft text-berry-deep border-berry/25",
  "Pending Approval": "bg-mango-soft text-mango-deep border-mango/30",
  "Payment Pending": "bg-mango-soft text-mango-deep border-mango/30",
  "Docs Pending": "bg-ocean-soft text-ocean-deep border-ocean/15",
  "Under Review": "bg-violet-soft text-violet-deep border-violet/20",
  "KYC Rejected": "bg-berry-soft text-berry-deep border-berry/25",
  Rejected: "bg-berry-soft text-berry-deep border-berry/25",
  Verified: "bg-emerald-soft text-emerald-deep border-emerald/20"
};

export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:opacity-70 before:content-['']",
        "whitespace-nowrap",
        statusClasses[status] ?? "border-line bg-white text-slate-700",
        className
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
