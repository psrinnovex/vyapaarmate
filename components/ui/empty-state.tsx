import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  illustration = "empty",
  title,
  body,
  action,
  className
}: {
  icon?: LucideIcon;
  /** Clay illustration shown above the title; pass `null` to show only the icon. */
  illustration?: ClayIllustrationName | null;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center rounded-3xl border border-white/80 bg-white/80 px-4 py-10 text-center shadow-clay", className)}>
      <div className="max-w-md">
        {illustration ? (
          <ClayIllustration name={illustration} className="mx-auto w-28 sm:w-32" />
        ) : (
          Icon && (
            <div className="clay-orb mx-auto size-14 bg-clay-emerald text-white">
              <Icon className="size-6" />
            </div>
          )
        )}
        <h2 className="mt-3 text-lg font-extrabold text-ink">{title}</h2>
        {body && <p className="mt-1.5 text-sm leading-6 text-slate-500">{body}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
