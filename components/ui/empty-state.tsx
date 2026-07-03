import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center", className)}>
      <div className="max-w-md">
        {Icon && (
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-emerald/10 text-emerald">
            <Icon className="size-6" />
          </div>
        )}
        <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
        {body && <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
