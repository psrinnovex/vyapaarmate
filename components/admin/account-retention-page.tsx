"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCOUNT_RETENTION_PURGE_CONFIRMATION } from "@/lib/account-deletion";

type RetentionRequest = {
  id: string;
  status: string;
  retentionNoticeVersion: string;
  retentionNotice: string;
  completedAt: string | null;
  retentionReviewAt: string | null;
  retentionLastReviewedAt: string | null;
  retentionReviewCount: number;
  retentionPurgeAfter: string | null;
  retentionPurgedAt: string | null;
  retentionHoldUntil: string | null;
  retentionHoldReason: string | null;
  business: { id: string; name: string; email: string } | null;
};

type RetentionResponse = {
  requests: RetentionRequest[];
  policyApprovedVersion: string | null;
  generatedAt: string;
};

async function fetchRetention(signal?: AbortSignal) {
  const response = await fetch("/api/admin/account-retention", { cache: "no-store", signal });
  const payload = (await response.json()) as RetentionResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not load retention controls.");
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function retentionState(request: RetentionRequest, now: number) {
  if (request.retentionPurgedAt) return { label: "Purged", tone: "bg-slate-200 text-slate-700" };
  if (request.retentionHoldUntil && new Date(request.retentionHoldUntil).getTime() > now) {
    return { label: "Legal hold", tone: "bg-purple-100 text-purple-800" };
  }
  if (request.retentionPurgeAfter && new Date(request.retentionPurgeAfter).getTime() <= now) {
    return { label: "Purge due", tone: "bg-red-100 text-red-800" };
  }
  if (request.retentionReviewAt && new Date(request.retentionReviewAt).getTime() <= now) {
    return { label: "Review due", tone: "bg-amber-100 text-amber-800" };
  }
  return { label: "Scheduled", tone: "bg-emerald-100 text-emerald-800" };
}

export function AdminAccountRetentionPage() {
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchRetention());
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not load retention controls." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchRetention(controller.signal)
      .then(setData)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not load retention controls." });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function runAction(requestId: string, body: Record<string, unknown>, success: string) {
    setBusyId(requestId);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/account-retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...body })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Retention action failed.");
      setNotice({ tone: "success", message: success });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Retention action failed." });
    } finally {
      setBusyId(null);
    }
  }

  function completeReview(request: RetentionRequest) {
    const note = window.prompt("Enter the approved retention-review reason (minimum 10 characters):")?.trim();
    if (!note) return;
    const confirmation = window.prompt('Type "RETAIN UNDER APPROVED POLICY" to record this review:')?.trim();
    if (confirmation !== "RETAIN UNDER APPROVED POLICY") {
      setNotice({ tone: "error", message: "Review confirmation did not match." });
      return;
    }
    void runAction(request.id, { action: "complete_review", confirmation, note }, "Retention review recorded.");
  }

  function setHold(request: RetentionRequest) {
    const holdUntil = window.prompt("Legal hold end in ISO format, for example 2030-01-31T18:30:00+05:30:")?.trim();
    if (!holdUntil) return;
    const reason = window.prompt("Enter the proceeding, investigation, or legal-hold reason (minimum 10 characters):")?.trim();
    if (!reason) return;
    void runAction(request.id, { action: "set_hold", holdUntil, reason }, "Legal hold recorded.");
  }

  function releaseHold(request: RetentionRequest) {
    const reason = window.prompt("Enter the authorized reason for releasing this legal hold (minimum 10 characters):")?.trim();
    if (!reason) return;
    void runAction(request.id, { action: "release_hold", reason }, "Legal hold released.");
  }

  function purgeDueRecords(request: RetentionRequest) {
    const confirmation = window.prompt(`Final purge cannot be undone. Type "${ACCOUNT_RETENTION_PURGE_CONFIRMATION}" to continue:`)?.trim();
    if (confirmation !== ACCOUNT_RETENTION_PURGE_CONFIRMATION) {
      setNotice({ tone: "error", message: "Purge confirmation did not match." });
      return;
    }
    void runAction(request.id, { action: "purge_due_records", confirmation }, "Final retained-record purge completed.");
  }

  const now = data ? new Date(data.generatedAt).getTime() : 0;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 text-slate-950 sm:p-6 xl:p-8">
      <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Privacy operations</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Account data retention</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Review anonymized business records, document time-limited legal holds, and purge records only when the approved deadline is due.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {notice ? (
        <div role="status" className={`mt-4 rounded-xl border p-4 text-sm font-semibold ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          {notice.message}
        </div>
      ) : null}

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Policy approved</p><p className="mt-2 font-black">{data?.policyApprovedVersion ?? "Required before release"}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tracked requests</p><p className="mt-2 text-2xl font-black">{data?.requests.length ?? 0}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Last refreshed</p><p className="mt-2 font-black">{formatDate(data?.generatedAt ?? null)}</p></div>
      </section>

      <section className="mt-5 space-y-4">
        {!loading && data?.requests.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No business deletion retention records exist yet.</div> : null}
        {data?.requests.map((request) => {
          const state = retentionState(request, now);
          const disabled = busyId === request.id || Boolean(request.retentionPurgedAt);
          const purgeDue = Boolean(request.retentionPurgeAfter && new Date(request.retentionPurgeAfter).getTime() <= now);
          const reviewDue = Boolean(request.retentionReviewAt && new Date(request.retentionReviewAt).getTime() <= now && !purgeDue);
          return (
            <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black">{request.business?.name ?? "Purged business record"}</h2>
                  <p className="mt-1 break-all text-xs text-slate-500">Request {request.id} · policy {request.retentionNoticeVersion}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${state.tone}`}>{state.label}</span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><dt className="font-bold text-slate-500">Deletion completed</dt><dd className="mt-1">{formatDate(request.completedAt)}</dd></div>
                <div><dt className="font-bold text-slate-500">Next review</dt><dd className="mt-1">{formatDate(request.retentionReviewAt)}</dd></div>
                <div><dt className="font-bold text-slate-500">Final purge after</dt><dd className="mt-1">{formatDate(request.retentionPurgeAfter)}</dd></div>
                <div><dt className="font-bold text-slate-500">Review count</dt><dd className="mt-1">{request.retentionReviewCount}</dd></div>
              </dl>
              {request.retentionHoldUntil ? <p className="mt-4 rounded-lg bg-purple-50 p-3 text-sm text-purple-900"><strong>Hold until {formatDate(request.retentionHoldUntil)}:</strong> {request.retentionHoldReason}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {reviewDue ? <button type="button" disabled={disabled} onClick={() => completeReview(request)} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Complete due review</button> : null}
                {!request.retentionPurgedAt ? <button type="button" disabled={disabled} onClick={() => setHold(request)} className="rounded-lg border border-purple-300 px-3 py-2 text-sm font-bold text-purple-800 disabled:opacity-50">Set legal hold</button> : null}
                {request.retentionHoldUntil ? <button type="button" disabled={disabled} onClick={() => releaseHold(request)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">Release hold</button> : null}
                {purgeDue && !request.retentionHoldUntil && !request.retentionPurgedAt ? <button type="button" disabled={disabled} onClick={() => purgeDueRecords(request)} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Purge due records</button> : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
