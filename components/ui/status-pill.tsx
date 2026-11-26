import { cn } from "@/lib/utils";

// Order, payment, subscription and business states on the Marigold Bazaar status palette.
const tone = {
  ink: "bg-ink text-white border-ink theme-dark",
  info: "bg-peacock-100 text-peacock-700 border-peacock-700/15",
  warning: "bg-marigold-100 text-marigold-800 border-marigold-600/25",
  success: "bg-green-100 text-green-800 border-green-700/15",
  neutral: "bg-ivory-100 text-ink-700 border-ink-200",
  danger: "bg-kumkum-100 text-kumkum-700 border-kumkum-700/15"
} as const;

const statusClasses: Record<string, string> = {
  NEW: tone.ink,
  ACCEPTED: tone.info,
  PREPARING: tone.warning,
  READY: tone.success,
  DELIVERED: tone.neutral,
  CANCELLED: tone.danger,
  PENDING: tone.warning,
  COMPLETED: tone.success,
  FAILED: tone.danger,
  REFUNDED: tone.info,
  ACTIVE: tone.success,
  TRIAL: tone.info,
  PAST_DUE: tone.warning,
  Active: tone.success,
  Trial: tone.info,
  Inactive: tone.neutral,
  Suspended: tone.danger,
  "Pending Approval": tone.warning,
  "Payment Pending": tone.warning,
  "Docs Pending": tone.info,
  "Under Review": tone.info,
  "KYC Rejected": tone.danger,
  Rejected: tone.danger,
  Verified: tone.success
};

export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:opacity-70 before:content-['']",
        "whitespace-nowrap",
        statusClasses[status] ?? "border-ink-200 bg-white text-ink-700",
        className
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
