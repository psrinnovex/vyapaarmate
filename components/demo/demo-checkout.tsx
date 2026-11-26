"use client";

import { useState } from "react";
import { ArrowLeft, Check, FlaskConical, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { SuccessIllustration } from "@/components/illustrations/clay-illustrations";
import { Button } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { cn } from "@/lib/utils";

type Outcome = "success" | "failure";

const qrCells = [0, 1, 2, 4, 6, 7, 9, 12, 13, 15, 16, 18, 20, 23, 25, 26, 27, 29, 30, 33, 35, 36, 38, 41, 42, 44, 45, 47];

/**
 * Demo Pay: a stand-in for the Cashfree checkout used when DEMO_MODE is on. The buttons
 * settle the payment through /api/demo/payments, which runs the real webhook logic.
 */
export function DemoCheckout({
  kind,
  id,
  amountLabel,
  merchant,
  reference,
  backUrl
}: {
  kind: "order" | "subscription";
  id: string;
  amountLabel: string;
  merchant: string;
  reference: string;
  backUrl: string;
}) {
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [done, setDone] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(outcome: Outcome) {
    setBusy(outcome);
    setError(null);
    try {
      const response = await fetch("/api/demo/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, outcome })
      });
      const payload = (await response.json().catch(() => ({}))) as { returnUrl?: string; error?: string };
      if (!response.ok || !payload.returnUrl) throw new Error(payload.error ?? "Demo payment could not be completed.");
      setDone(outcome);
      window.setTimeout(() => window.location.assign(payload.returnUrl!), outcome === "success" ? 1400 : 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demo payment could not be completed.");
      setBusy(null);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <div className="clay relative overflow-hidden rounded-[2.25rem] p-6 text-center">
        <div className="absolute right-4 top-4">
          <Sticker tone="marigold" tilt={6} icon={<FlaskConical className="size-3" />}>
            Demo
          </Sticker>
        </div>
        <p className="text-left text-sm font-extrabold text-ink-500">Demo Pay · UPI</p>

        {done === "success" ? (
          <div className="py-6" role="status">
            <SuccessIllustration className="mx-auto w-40 motion-safe:animate-pop" />
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-ink">Paid {amountLabel}</p>
            <p className="mt-1 text-sm font-semibold text-ink-500">Taking you back…</p>
          </div>
        ) : (
          <>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Paying {merchant}</p>
            <p className="mt-1 text-5xl font-extrabold tracking-[-0.05em] text-ink">{amountLabel}</p>
            <p className="mt-1 text-xs font-bold text-ink-500">{reference}</p>

            <div className="relative mx-auto mt-6 w-fit rounded-[1.5rem] bg-white p-3.5 shadow-clay">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 49 }).map((_, index) => (
                  <span key={index} className={cn("size-5 rounded-[5px]", qrCells.includes(index) ? "bg-ink" : "bg-ivory-100")} />
                ))}
              </div>
              <span className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-clay-peacock text-xs font-extrabold text-white shadow-clay-sm">
                UPI
              </span>
            </div>

            <div className="mt-6 grid gap-2.5">
              <Button size="lg" className="w-full" disabled={busy !== null} onClick={() => settle("success")}>
                {busy === "success" ? <LoaderCircle className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={3} />}
                Pay {amountLabel}
              </Button>
              <Button variant="secondary" className="w-full" disabled={busy !== null} onClick={() => settle("failure")}>
                {busy === "failure" ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
                {done === "failure" ? "Declined" : "Decline payment"}
              </Button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-kumkum-50 px-3 py-2 text-sm font-bold text-kumkum-700">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 px-2 text-xs font-bold text-ink-500">
        <a href={backUrl} className="inline-flex items-center gap-1.5 transition hover:text-ink">
          <ArrowLeft className="size-3.5" /> Back
        </a>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-brand-text" /> Simulated. No real money moves.
        </span>
      </div>
    </div>
  );
}
