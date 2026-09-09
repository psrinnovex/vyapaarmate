"use client";

import { useState, type FormEvent } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { PilotReport } from "@/lib/pilot-data";
import { formatINR } from "@/lib/utils";

const cohortNames = { BENGALURU: "Bengaluru", ANDHRA_PRADESH: "Andhra Pradesh" };
const date = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function PilotPage({ initialReport }: { initialReport: PilotReport }) {
  const [report, setReport] = useState(initialReport);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = event ? new FormData(event.currentTarget) : null;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/pilot", form ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: form.get("businessId"), cohort: form.get("cohort") || null, consentConfirmed: form.get("consent") === "on" }) } : { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load the pilot report.");
      setReport(body); setMessage(form ? "Pilot enrollment saved and audit recorded." : "Report refreshed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  function download() {
    // Export aggregate evidence only; exclude the merchant management list.
    const evidence = { generatedAt: report.generatedAt, currentStart: report.currentStart, previousStart: report.previousStart, excludedFixtures: report.excludedFixtures, cohorts: report.cohorts };
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `vyapaarmate-pilot-${report.generatedAt.slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className="min-w-0 space-y-6 p-4 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold sm:text-3xl">Pilot evidence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">Separate Bengaluru and Andhra Pradesh cohorts. Counts reflect enrolled live records; demo, seed and test businesses do not count as traction.</p></div><div className="flex gap-2"><button onClick={() => void update()} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm disabled:opacity-50"><RefreshCw className="size-4" />Refresh</button><button onClick={download} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-ink"><Download className="size-4" />Export</button></div></div>
      <div className="rounded-xl border border-emerald/30 bg-emerald/10 p-4 text-sm leading-6 text-white/85"><p>Current window: {date(report.currentStart)} to {date(report.generatedAt)} IST.</p><p>Previous window: {date(report.previousStart)} to {date(report.currentStart)} IST. Excluded non-live enrolled businesses: {report.excludedFixtures}.</p></div>
      <div className="grid gap-5 xl:grid-cols-2">{report.cohorts.map(row => <section key={row.cohort} className="rounded-xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-bold">{cohortNames[row.cohort]}</h2><dl className="mt-5 grid grid-cols-2 gap-5">{[
        ["Enrolled businesses", row.enrolled], ["Setup completed", row.onboarded], ["First real order since enrollment", row.activated], ["Active this week", row.activeCurrent], ["Recorded paid subscriptions", row.paidBusinesses], ["Monthly recurring value, excluding GST", formatINR(row.recurringValue)], ["Weekly repeat use", row.repeatUseRate === null ? "No prior-week activity" : `${row.repeatUseRate}% (${row.activeBoth}/${row.activePrevious})`], ["Merchant order value this week", formatINR(row.merchantOrderValue)]
      ].map(([label, value]) => <div key={label}><dt className="text-xs leading-5 text-white/60">{label}</dt><dd className="mt-1 break-words text-xl font-bold">{value}</dd></div>)}</dl></section>)}</div>
      <section className="rounded-xl border border-white/10 bg-white/5 p-5"><h2 className="text-xl font-bold">Enroll a consenting merchant</h2><p className="mt-2 text-sm leading-6 text-white/60">Keep the merchant’s consent record with the pilot documentation. This action records the administrator, cohort and confirmation time. Changing cohorts restarts the enrollment period.</p><form onSubmit={update} className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm">Business<select name="businessId" required className="min-h-11 min-w-0 rounded-lg border border-white/20 bg-slate-900 p-3"><option value="">Select a business</option>{report.businesses.map(business => <option key={business.id} value={business.id}>{business.name} · {business.city} · {business.dataOrigin}{business.pilotCohort ? ` · ${cohortNames[business.pilotCohort]}` : ""}</option>)}</select></label><label className="grid gap-2 text-sm">Cohort<select name="cohort" className="min-h-11 rounded-lg border border-white/20 bg-slate-900 p-3"><option value="BENGALURU">Bengaluru</option><option value="ANDHRA_PRADESH">Andhra Pradesh</option><option value="">Remove enrollment</option></select></label><label className="flex items-start gap-3 text-sm leading-6 md:col-span-2"><input type="checkbox" name="consent" className="mt-1 size-4" />I have recorded the merchant’s consent to participate in this pilot.</label><button disabled={busy} className="min-h-11 rounded-lg bg-emerald px-5 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save enrollment"}</button></form>{report.businesses.length === 200 && <p className="mt-3 text-sm text-white/60">The selector shows the first 200 businesses by name. Aggregate metrics include every eligible enrollment.</p>}<p role="status" className="mt-3 text-sm text-white">{message}</p></section>
      <section className="text-sm leading-7 text-white/60"><h2 className="font-bold text-white">Metric definitions</h2><p>Active means at least one live, non-cancelled order during the window and after enrollment. Weekly repeat use is businesses active in both windows divided by businesses active in the previous window; an empty denominator is not reported as a percentage.</p><p>Recurring value uses the latest currently paid monthly subscription per business, after recurring discounts and before GST or one-off upgrade credits. Merchant order value includes recorded paid orders and is separate from VyapaarMate subscription income. These are operational records, not audited financial statements.</p><p>Interview completion, onboarding minutes, support cost and willingness-to-pay findings require the dated pilot log. Historical records should be reviewed for correct provenance before presenting results externally.</p></section>
    </div>
  );
}
