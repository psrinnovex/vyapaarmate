import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  body,
  children,
  className
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 overflow-x-hidden px-4 py-16 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto max-w-7xl min-w-0">
        {(eyebrow || title || body) && (
          <div className="mb-10 w-[calc(100vw-2rem)] min-w-0 max-w-3xl sm:w-auto">
            {eyebrow && <p className="mb-3 text-sm font-bold uppercase text-emerald">{eyebrow}</p>}
            {title && <h2 className="break-words text-3xl font-bold text-ink sm:text-4xl">{title}</h2>}
            {body && <p className="mt-4 break-words text-base leading-7 text-slate-600 sm:text-lg">{body}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  body,
  action,
  tone = "light",
  className
}: HTMLAttributes<HTMLDivElement> & { title: string; body?: string; action?: ReactNode; tone?: "light" | "dark" }) {
  const isDark = tone === "dark";

  return (
    <div className={cn("mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "break-words font-bold leading-tight",
            isDark ? "text-xl text-white sm:text-2xl" : "text-2xl text-ink sm:text-3xl"
          )}
        >
          {title}
        </h1>
        {body && <p className={cn("mt-2 max-w-3xl text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>{body}</p>}
      </div>
      {action && <div className="min-w-0 sm:shrink-0">{action}</div>}
    </div>
  );
}
