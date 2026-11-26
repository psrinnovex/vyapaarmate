"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useSupportAssignmentAlertFeed } from "@/hooks/use-support-assignment-alert";
import { cn } from "@/lib/utils";

type AlertSession = {
  id: string;
  role: string;
};

type SessionResponse = {
  user?: AlertSession | null;
};

const supportAlertRoles = new Set(["SUPER_ADMIN", "SUPPORT_AGENT"]);

export function SupportAgentAlerts() {
  const pathname = usePathname();
  const [session, setSession] = useState<AlertSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = () => {
      void fetchAlertSession()
        .then((nextSession) => {
          if (cancelled) return;
          setSession(nextSession);
        })
        .catch(() => {
          if (!cancelled) setSession(null);
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadSession();
    };

    loadSession();
    window.addEventListener("focus", loadSession);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(loadSession, 60000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadSession);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [pathname]);

  const alertFeed = useSupportAssignmentAlertFeed({
    currentUserId: session?.id ?? null,
    enabled: Boolean(session),
    href: session?.role === "SUPER_ADMIN" ? "/admin/support" : "/support"
  });

  if (alertFeed.pendingAlerts.length === 0) return null;

  return (
    <div className="fixed right-3 top-3 z-[90] grid w-[min(24rem,calc(100vw-1.5rem))] gap-2 sm:right-5 sm:top-5" aria-live="assertive">
      {alertFeed.pendingAlerts.map((alert, index) => {
        const rejecting = alertFeed.actionId === `reject:${alert.key}`;
        const latest = index === 0;

        return (
          <div
            key={alert.key}
            className={cn(
              "rounded-lg border bg-white p-3 shadow-[0_18px_54px_rgba(11,13,11,0.22)]",
              latest ? "border-brand/30 ring-4 ring-brand/10" : "border-ink-200"
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-white",
                alert.kind === "customer-message" ? "bg-brand" : "bg-ink"
              )}>
                <CheckCircle2 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-extrabold text-ink">
                    {alert.kind === "customer-message" ? "New support message" : "Support chat connected"}
                  </p>
                  {latest && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-brand-text">Newest</span>}
                </div>
                <p className="mt-1 text-xs font-bold uppercase text-ink-500">{ticketLabel(alert.ticket)}</p>
                <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-ink-700">
                  {alert.message?.body ?? alert.ticket.lastMessage ?? "A requester is waiting for support."}
                </p>
              </div>
            </div>

            {alertFeed.error && latest && (
              <p className="mt-3 rounded-lg bg-kumkum-50 px-3 py-2 text-xs font-semibold leading-5 text-kumkum-700">{alertFeed.error}</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => alertFeed.acceptAlert(alert.key)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-xs font-extrabold text-ink transition hover:bg-brand/90 focus:outline-none focus:ring-4 focus:ring-brand/20"
              >
                <CheckCircle2 className="size-4" />
                Accept
              </button>
              <button
                type="button"
                disabled={rejecting}
                onClick={() => void alertFeed.rejectAlert(alert.key)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-kumkum-600/25 bg-kumkum-50 px-3 text-xs font-extrabold text-kumkum-700 transition hover:bg-kumkum-600/15 focus:outline-none focus:ring-4 focus:ring-kumkum-100 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {rejecting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ticketLabel(ticket: { code?: string | null; subject?: string | null; businessName?: string | null }) {
  return ticket.code || ticket.subject || ticket.businessName || "Support chat";
}

async function fetchAlertSession() {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin"
  });
  const payload = response.ok ? await response.json() as SessionResponse : null;
  const user = payload?.user;
  return user && supportAlertRoles.has(user.role) ? user : null;
}
