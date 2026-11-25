import type { HTMLAttributes, ReactNode } from "react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  body,
  children,
  className,
  headingAs: Heading = "h2"
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  children: ReactNode;
  className?: string;
  headingAs?: "h1" | "h2";
}) {
  return (
    <section id={id} className={cn("min-w-0 overflow-x-hidden px-4 py-16 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto max-w-7xl min-w-0">
        {(eyebrow || title || body) && (
          <div className="mb-10 w-[calc(100vw-2rem)] min-w-0 max-w-3xl sm:w-auto">
            {eyebrow && <p className="mb-4 inline-flex rounded-full bg-emerald-soft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-emerald-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">{eyebrow}</p>}
            {title && <Heading className="break-words text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-[2.6rem] sm:leading-[1.08]">{title}</Heading>}
            {body && <p className="mt-4 break-words text-base leading-7 text-slate-600 sm:text-lg">{body}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

const heroArt: Array<[RegExp, ClayIllustrationName]> = [
  [/coupon|offer|discount/i, "success"],
  [/appointment|booking|schedule|calendar/i, "calendar"],
  [/report|analytic|insight|pilot|health/i, "chart"],
  [/\bai\b|intelligence|suggestion|recommend/i, "rocket"],
  [/customer|crm|client|user|people/i, "customers"],
  [/payment|upi|payout|wallet|refund/i, "upi"],
  [/invoice|billing|subscription|plan|checkout/i, "bag"],
  [/campaign|message|whatsapp|support|ticket|chat/i, "phone"],
  [/staff|team|role|setting|security|kyc|log|retention|admin/i, "shield"],
  [/menu|catalog|item|service|product/i, "bowl"],
  [/order|history|transaction|request/i, "bag"],
  [/business|shop|setup|store/i, "shop"]
];

function pickHeroArt(title: string): ClayIllustrationName {
  return heroArt.find(([pattern]) => pattern.test(title))?.[1] ?? "shop";
}

/**
 * Page hero used at the top of every app page: a soft clay band with the title, a short
 * line, actions, and a 3D illustration picked from the title (or passed explicitly).
 */
export function PageHeader({
  title,
  body,
  action,
  tone = "light",
  eyebrow,
  illustration,
  className
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "light" | "dark";
  eyebrow?: string;
  /** Clay illustration on the right; `null` hides it. Defaults to one matched from the title. */
  illustration?: ClayIllustrationName | null;
}) {
  const isDark = tone === "dark";
  const art = illustration === undefined ? pickHeroArt(title) : illustration;

  return (
    <section
      className={cn(
        "relative mb-6 min-w-0 overflow-hidden rounded-[2rem] p-5 sm:p-6",
        isDark
          ? "bg-[linear-gradient(135deg,#1d1a39_0%,#2b2160_60%,#3a2a8a_100%)] text-white shadow-clay-lg"
          : "border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(246,244,255,0.86)_55%,rgba(225,248,236,0.78)_100%)] shadow-clay",
        className
      )}
    >
      <div aria-hidden="true" className={cn("dotted-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_85%_50%,black_10%,transparent_60%)]", isDark && "opacity-20")} />
      <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p
              className={cn(
                "mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]",
                isDark ? "bg-white/10 text-emerald-200" : "bg-emerald-soft text-emerald-deep"
              )}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={cn(
              "break-words font-extrabold leading-[1.08] tracking-[-0.04em]",
              isDark ? "text-2xl text-white sm:text-[1.9rem]" : "text-[1.7rem] text-ink sm:text-[2.1rem]"
            )}
          >
            {title}
          </h1>
          {body && <p className={cn("mt-2 max-w-2xl text-sm font-medium leading-6", isDark ? "text-white/70" : "text-slate-500")}>{body}</p>}
          {action && <div className="mt-4 min-w-0">{action}</div>}
        </div>
        {art && (
          <div aria-hidden="true" className="hidden w-28 shrink-0 sm:block lg:w-36">
            <ClayIllustration name={art} />
          </div>
        )}
      </div>
    </section>
  );
}
