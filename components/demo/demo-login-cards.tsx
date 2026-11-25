"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemoRole } from "@/lib/demo-mode";

export type DemoRoleCard = {
  role: DemoRole;
  title: string;
  line: string;
  tint: string;
  /** Rendered illustration (an element, so server pages can pass it in). */
  art: ReactNode;
};

/** One-tap sign-in cards for the seeded demo accounts. */
export function DemoLoginCards({ cards }: { cards: DemoRoleCard[] }) {
  const [busy, setBusy] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(role: DemoRole) {
    setBusy(role);
    setError(null);
    try {
      const response = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      const payload = (await response.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!response.ok || !payload.redirect) throw new Error(payload.error ?? "Demo sign-in failed.");
      window.location.assign(payload.redirect);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demo sign-in failed.");
      setBusy(null);
    }
  }

  return (
    <>
      {cards.map(({ role, title, line, tint, art }) => (
        <button
          key={role}
          type="button"
          onClick={() => signIn(role)}
          disabled={busy !== null}
          className={cn(
            "clay group relative flex min-h-[17rem] flex-col rounded-[2rem] p-5 text-left transition hover:-translate-y-1 disabled:cursor-wait disabled:opacity-80",
            tint
          )}
        >
          <div className="flex flex-1 items-center justify-center [&_svg]:w-36 [&_svg]:transition-transform [&_svg]:duration-300 group-hover:[&_svg]:scale-105">
            {art}
          </div>
          <span className="text-lg font-extrabold tracking-[-0.02em] text-ink">{title}</span>
          <span className="mt-1 text-sm font-semibold text-slate-500">{line}</span>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-emerald-deep">
            {busy === role ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {busy === role ? "Signing in" : "Open"}
            {busy !== role && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
          </span>
        </button>
      ))}
      {error && (
        <p role="alert" className="col-span-full rounded-2xl bg-berry-soft px-4 py-3 text-sm font-bold text-berry-deep">
          {error}
        </p>
      )}
    </>
  );
}
