"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { company } from "@/lib/site";

type AccountRole =
  | "SUPER_ADMIN"
  | "SUPPORT_AGENT"
  | "OWNER"
  | "CUSTOMER"
  | "MANAGER"
  | "KITCHEN_STAFF"
  | "DELIVERY_STAFF";

type SessionSummary = {
  name: string;
  email: string;
  role: AccountRole;
};

type AccountDeletionRecord = {
  id: string;
  scope: "CUSTOMER" | "STAFF" | "BUSINESS";
  status: "AWAITING_VERIFICATION" | "REQUESTED" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REJECTED";
  scheduledFor: string;
  processingAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  retentionNoticeVersion: string;
  retentionNotice: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeletionApiPayload = {
  accountDeletion?: AccountDeletionRecord;
  requiredConfirmation?: string;
  accepted?: boolean;
  message?: string;
  error?: unknown;
};

function payloadError(payload: DeletionApiPayload, fallback: string) {
  return typeof payload.error === "string" ? payload.error : fallback;
}

function formattedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the scheduled date shown in your confirmation";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

function DeletionResult({ deletion }: { deletion: AccountDeletionRecord }) {
  const complete = deletion.status === "COMPLETED";
  return (
    <Card className="border-emerald/30 bg-emerald/5" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald text-white">
          {complete ? <CheckCircle2 className="size-5" /> : <Clock3 className="size-5" />}
        </span>
        <div>
          <h2 className="text-xl font-bold text-ink">{complete ? "Account deletion completed" : "Business deletion scheduled"}</h2>
          <p className="mt-2 leading-7 text-slate-600">
            {complete
              ? "The verified personal account request completed and active sign-in access was removed."
              : `Commerce, integrations, subscription access, and active sessions are disabled. Processing is scheduled for ${formattedDate(deletion.scheduledFor)}.`}
          </p>
          <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-slate-600">{deletion.retentionNotice}</p>
        </div>
      </div>
    </Card>
  );
}

function VerifiedEmailConfirmation({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [deletion, setDeletion] = useState<AccountDeletionRecord | null>(null);
  const [requiredConfirmation, setRequiredConfirmation] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState<AccountDeletionRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStatus() {
      setLoading(true);
      setStatusError("");
      try {
        const response = await fetch("/api/account-deletion/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => ({}))) as DeletionApiPayload;
        if (!response.ok || !payload.accountDeletion || typeof payload.requiredConfirmation !== "string") {
          setStatusError(payloadError(payload, "This deletion link is invalid or expired. Request a new link below."));
          return;
        }
        setDeletion(payload.accountDeletion);
        setRequiredConfirmation(payload.requiredConfirmation);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatusError("We could not verify this deletion link. Check your connection and request a new link if needed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadStatus();
    return () => controller.abort();
  }, [token]);

  async function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requiredConfirmation || confirmation !== requiredConfirmation) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/account-deletion/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, confirmation })
      });
      const payload = (await response.json().catch(() => ({}))) as DeletionApiPayload;
      if (!response.ok || !payload.accountDeletion) {
        setSubmitError(payloadError(payload, "Deletion could not be completed. No partial deletion was committed."));
        return;
      }
      window.history.replaceState(null, document.title, "/account-deletion");
      setCompleted(payload.accountDeletion);
    } catch {
      setSubmitError("Deletion could not be completed. Check your connection and try again before the link expires.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) return <DeletionResult deletion={completed} />;

  return (
    <Card className="border-red-200 bg-red-50/40">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-red-600 text-white"><ShieldCheck className="size-5" /></span>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-red-700">Verified email link</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Review and confirm deletion</h2>
        </div>
      </div>

      {loading && <p className="mt-5 rounded-lg bg-white p-4 font-semibold text-slate-600" role="status">Verifying the single-use link…</p>}
      {statusError && <p className="mt-5 rounded-lg bg-red-100 p-4 font-semibold text-red-800" role="alert">{statusError}</p>}
      {!loading && deletion && requiredConfirmation && (
        <form className="mt-5 grid gap-4" onSubmit={confirmDeletion}>
          <div className="rounded-lg bg-white p-4 text-sm leading-6 text-slate-600">
            <p><span className="font-bold text-ink">Scope:</span> {deletion.scope === "BUSINESS" ? "Business account" : deletion.scope === "STAFF" ? "Staff account" : "Customer account"}</p>
            <p className="mt-2">{deletion.retentionNotice}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="verified-deletion-confirmation">Type <span className="font-extrabold text-red-700">{requiredConfirmation}</span> to confirm</Label>
            <Input
              id="verified-deletion-confirmation"
              value={confirmation}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              onChange={(event) => setConfirmation(event.currentTarget.value)}
            />
          </div>
          {submitError && <p className="rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800" role="alert">{submitError}</p>}
          <Button
            type="submit"
            variant="danger"
            icon={<Trash2 className="size-4" />}
            disabled={submitting || confirmation !== requiredConfirmation}
            aria-busy={submitting}
          >
            {submitting ? "Processing deletion" : deletion.scope === "BUSINESS" ? "Delete business account" : "Permanently delete account"}
          </Button>
        </form>
      )}
    </Card>
  );
}

function AuthenticatedDeletion({
  session,
  personalConfirmation,
  businessConfirmation
}: {
  session: SessionSummary;
  personalConfirmation: string;
  businessConfirmation: string;
}) {
  const supportedPersonalRole = ["CUSTOMER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"].includes(session.role);
  const isOwner = session.role === "OWNER";
  const requiredConfirmation = isOwner ? businessConfirmation : personalConfirmation;
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AccountDeletionRecord | null>(null);

  if (!isOwner && !supportedPersonalRole) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <h2 className="text-xl font-bold text-ink">Protected team account</h2>
        <p className="mt-2 leading-7 text-amber-950">Administrator and support-agent identities are not mobile product accounts and cannot use this deletion workflow. Contact the authorized platform account owner through general support.</p>
      </Card>
    );
  }

  async function submitAuthenticatedDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword || confirmation !== requiredConfirmation) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(isOwner ? "/api/dashboard/account/deletion-request" : "/api/account/delete", {
        method: isOwner ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(isOwner ? { "Idempotency-Key": crypto.randomUUID() } : {})
        },
        body: JSON.stringify({
          currentPassword,
          confirmation,
          ...(isOwner && reason.trim() ? { reason: reason.trim() } : {})
        })
      });
      const payload = (await response.json().catch(() => ({}))) as DeletionApiPayload;
      if (!response.ok || !payload.accountDeletion) {
        setError(payloadError(payload, "Account deletion could not be completed. No partial deletion was committed."));
        return;
      }
      setResult(payload.accountDeletion);
    } catch {
      setError("Account deletion could not be completed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <DeletionResult deletion={result} />;

  return (
    <Card className="border-red-200 bg-red-50/30">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-red-600 text-white"><LockKeyhole className="size-5" /></span>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-red-700">Signed in</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{isOwner ? "Request business-account deletion" : "Delete this account"}</h2>
          <p className="mt-1 text-sm text-slate-600">{session.name} · {session.email}</p>
        </div>
      </div>
      <p className="mt-4 leading-7 text-slate-600">
        {isOwner
          ? "The business is frozen immediately and scheduled for deletion after 30 days, subject to the disclosed retention requirements."
          : "The verified account, active sessions, and personal fields not covered by documented retention requirements are removed or anonymized."}
      </p>
      <form className="mt-5 grid gap-4" onSubmit={submitAuthenticatedDeletion}>
        <div className="grid gap-2">
          <Label htmlFor="authenticated-deletion-password">Current password</Label>
          <Input
            id="authenticated-deletion-password"
            type="password"
            value={currentPassword}
            autoComplete="current-password"
            required
            onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          />
        </div>
        {isOwner && (
          <div className="grid gap-2">
            <Label htmlFor="authenticated-deletion-reason">Reason (optional)</Label>
            <Textarea
              id="authenticated-deletion-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.currentTarget.value)}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="authenticated-deletion-confirmation">Type <span className="font-extrabold text-red-700">{requiredConfirmation}</span> to confirm</Label>
          <Input
            id="authenticated-deletion-confirmation"
            value={confirmation}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            onChange={(event) => setConfirmation(event.currentTarget.value)}
          />
        </div>
        {error && <p className="rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p>}
        <Button
          type="submit"
          variant="danger"
          icon={<Trash2 className="size-4" />}
          disabled={submitting || !currentPassword || confirmation !== requiredConfirmation}
          aria-busy={submitting}
        >
          {submitting ? "Processing deletion" : isOwner ? "Request permanent business deletion" : "Permanently delete account"}
        </Button>
      </form>
    </Card>
  );
}

function PublicDeletionRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/account-deletion/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = (await response.json().catch(() => ({}))) as DeletionApiPayload;
      if (!response.ok) {
        setError(payloadError(payload, "We could not accept this request. Check the email address and try again."));
        return;
      }
      setMessage(
        typeof payload.message === "string"
          ? payload.message
          : "If an eligible verified account matches that email, a single-use deletion link will be sent."
      );
    } catch {
      setError("We could not accept this request. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-ocean text-white"><Mail className="size-5" /></span>
        <div>
          <h2 className="text-xl font-bold text-ink">Request deletion without signing in</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Use the verified email address on the account. The response never reveals whether an account exists.</p>
        </div>
      </div>
      <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={submitRequest}>
        <div className="grid gap-2">
          <Label htmlFor="public-deletion-email">Account email</Label>
          <Input
            id="public-deletion-email"
            type="email"
            value={email}
            autoComplete="email"
            maxLength={254}
            required
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </div>
        <Button type="submit" variant="primary" icon={<Mail className="size-4" />} disabled={submitting} aria-busy={submitting}>
          {submitting ? "Sending request" : "Email secure deletion link"}
        </Button>
      </form>
      {message && <p className="mt-4 rounded-lg bg-emerald/10 p-3 text-sm font-semibold leading-6 text-emerald" role="status">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700" role="alert">{error}</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">The single-use link expires after 30 minutes. No account is changed unless the link is opened and the required confirmation phrase is entered.</p>
    </Card>
  );
}

export function AccountDeletionPageContent({
  session,
  personalConfirmation,
  businessConfirmation
}: {
  session: SessionSummary | null;
  personalConfirmation: string;
  businessConfirmation: string;
}) {
  const [emailToken, setEmailToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const prefix = "#token=";
    const fragment = window.location.hash;
    if (!fragment.startsWith(prefix)) return () => { active = false; };
    let token = "";
    try {
      token = decodeURIComponent(fragment.slice(prefix.length));
    } catch {
      token = "";
    }
    window.history.replaceState(null, document.title, "/account-deletion");
    if (token.length >= 64 && token.length <= 300) {
      queueMicrotask(() => {
        if (active) setEmailToken(token);
      });
    }
    return () => { active = false; };
  }, []);

  return (
    <>
      <header className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-700">Account deletion</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Delete a VyapaarMate account and associated personal data</h1>
        <p className="mt-5 max-w-3xl leading-7 text-slate-600">This public resource works after uninstalling the app. Request a single-use email link, or sign in and use password confirmation. Deactivation alone is not treated as account deletion.</p>
      </header>

      <div className="grid gap-5">
        {emailToken && <VerifiedEmailConfirmation token={emailToken} />}
        {session && !emailToken && (
          <AuthenticatedDeletion
            session={session}
            personalConfirmation={personalConfirmation}
            businessConfirmation={businessConfirmation}
          />
        )}
        <PublicDeletionRequest />

        {!session && (
          <Card className="bg-mist">
            <h2 className="text-xl font-bold text-ink">Prefer to sign in?</h2>
            <p className="mt-2 leading-7 text-slate-600">Use the matching portal, then return here for password-confirmed deletion.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href="/login?type=user&next=%2Faccount-deletion" variant="secondary">Customer sign in</ButtonLink>
              <ButtonLink href="/login?type=business&next=%2Faccount-deletion" variant="secondary">Business or staff sign in</ButtonLink>
            </div>
          </Card>
        )}

        <Card className="bg-white">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 size-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-xl font-bold text-ink">What may be retained</h2>
              <p className="mt-2 leading-7 text-slate-600">Orders, appointments, invoices, payments, payouts, a minimal KYC verification outcome, tax, fraud-prevention, dispute, security, and audit records may be retained only for a documented legal, accounting, dispute, or security purpose. Uploaded KYC document files and personal fields not needed for an approved retention purpose are deleted or anonymized.</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">For account recovery or general assistance, email <a className="font-semibold text-ocean hover:underline" href={`mailto:${company.supportEmail}?subject=${encodeURIComponent("VyapaarMate account deletion support")}`}>{company.supportEmail}</a>. Do not send a password, OTP, identity document, bank detail, or payment credential by email.</p>
            </div>
          </div>
        </Card>

        <p className="text-center text-sm text-slate-500">Read the <Link className="font-semibold text-ocean hover:underline" href="/mobile/privacy">Mobile App Privacy Notice</Link> for data categories and choices.</p>
      </div>
    </>
  );
}
