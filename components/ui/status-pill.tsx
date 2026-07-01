import { cn } from "@/lib/utils";

const statusClasses: Record<string, string> = {
  NEW: "bg-blue-50 text-ocean border-blue-100",
  ACCEPTED: "bg-violet/10 text-violet border-violet/20",
  PREPARING: "bg-amber-100 text-amber-800 border-amber-200",
  READY: "bg-emerald/10 text-emerald border-emerald/20",
  DELIVERED: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald/10 text-emerald border-emerald/20",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  REFUNDED: "bg-violet/10 text-violet border-violet/20",
  ACTIVE: "bg-emerald/10 text-emerald border-emerald/20",
  TRIAL: "bg-violet/10 text-violet border-violet/20",
  PAST_DUE: "bg-amber-100 text-amber-800 border-amber-200",
  Active: "bg-emerald/10 text-emerald border-emerald/20",
  Trial: "bg-violet/10 text-violet border-violet/20",
  Inactive: "bg-slate-100 text-slate-700 border-slate-200",
  Suspended: "bg-red-50 text-red-700 border-red-200",
  "Pending Approval": "bg-amber-100 text-amber-800 border-amber-200",
  "Payment Pending": "bg-amber-100 text-amber-800 border-amber-200",
  "Docs Pending": "bg-blue-50 text-ocean border-blue-100",
  "Under Review": "bg-violet/10 text-violet border-violet/20",
  "KYC Rejected": "bg-red-50 text-red-700 border-red-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Verified: "bg-emerald/10 text-emerald border-emerald/20"
};

export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        "whitespace-nowrap",
        statusClasses[status] ?? "border-line bg-white text-slate-700",
        className
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
