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
          <span className="mt-1 text-sm font-semibold text-ink-500">{line}</span>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-green-700">
            {busy === role ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {busy === role ? "Signing in" : "Open"}
            {busy !== role && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
          </span>
        </button>
      ))}
      {error && (
        <p role="alert" className="col-span-full rounded-2xl bg-kumkum-50 px-4 py-3 text-sm font-bold text-kumkum-700">
          {error}
        </p>
      )}
    </>
  );
}

/** Big "order as a customer" card: signs in the verified demo customer, then opens the demo shop. */
export function DemoCustomerCard({ art }: { art: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "customer" })
      });
      const payload = (await response.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!response.ok || !payload.redirect) throw new Error(payload.error ?? "Demo sign-in failed.");
      window.location.assign(payload.redirect);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demo sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="group relative flex min-h-[17rem] flex-col overflow-hidden rounded-[2rem] bg-clay-ink p-5 text-left text-white shadow-clay-lg transition hover:-translate-y-1 disabled:cursor-wait sm:col-span-2 lg:col-span-1 lg:row-span-2 theme-dark"
    >
      <span className="sticker self-start -rotate-3 bg-clay-green text-ink">One tap</span>
      <span className="flex flex-1 items-center justify-center py-4 [&_svg]:w-44 [&_svg]:transition-transform [&_svg]:duration-300 group-hover:[&_svg]:scale-105 lg:[&_svg]:w-56">{art}</span>
      <span className="text-2xl font-extrabold tracking-[-0.03em]">Order as a customer</span>
      <span className="mt-1 text-sm font-semibold text-white/70">Browse the menu, pay with Demo UPI and track the order.</span>
      <span className="mt-4 inline-flex items-center gap-2 self-start rounded-2xl bg-clay-green px-4 py-2.5 text-sm font-extrabold shadow-clay-sm">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {busy ? "Opening shop" : "Open demo shop"}
        {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
      </span>
      {error && <span role="alert" className="mt-3 rounded-xl bg-kumkum-50 px-3 py-2 text-xs font-bold text-kumkum-700">{error}</span>}
    </button>
  );
}
