"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { authPath, type AuthPortal } from "@/lib/auth-portal";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils";

const passwordFieldLabels: Record<string, string> = {
  currentPassword: "Current password",
  password: "New password"
};

async function readPasswordChangeError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;

    if (body.error && typeof body.error === "object") {
      const flattened = body.error as {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
      const formErrors = flattened.formErrors ?? [];
      const fieldErrors = Object.entries(flattened.fieldErrors ?? {}).flatMap(([field, messages]) =>
        (messages ?? []).map((message) => `${passwordFieldLabels[field] ?? field}: ${message}`)
      );
      const errors = [...formErrors, ...fieldErrors];
      if (errors.length > 0) return errors.join(" ");
    }

    return fallback;
  } catch {
    return fallback;
  }
}

type PasswordChangeCardProps = {
  portal: AuthPortal;
  title?: string;
  body?: string;
  className?: string;
  surface?: "card" | "plain";
  showHeader?: boolean;
};

export function PasswordChangeCard({
  portal,
  title = "Account security",
  body = "Update the password for your signed-in account.",
  className = "",
  surface = "card",
  showHeader = true
}: PasswordChangeCardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword"));
    const password = String(form.get("password"));
    const confirmPassword = String(form.get("confirmPassword"));

    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password })
      });

      if (!response.ok) {
        setError(await readPasswordChangeError(response, "Could not update password. Check the current password and try again."));
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      formRef.current?.reset();
      setMessage(payload.message ?? "Password updated successfully.");
    } catch {
      setError("Could not reach the password service. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <>
      {showHeader && (
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
          </div>
        </div>
      )}

      <form ref={formRef} className={cn("grid gap-4", showHeader && "mt-5")} onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor={`${portal}-current-password`}>Current password</Label>
          <PasswordInput
            id={`${portal}-current-password`}
            name="currentPassword"
            autoComplete="current-password"
            showLockIcon
            required
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${portal}-new-password`}>New password</Label>
            <PasswordInput
              id={`${portal}-new-password`}
              name="password"
              autoComplete="new-password"
              placeholder="10+ characters"
              minLength={10}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${portal}-confirm-password`}>Confirm new password</Label>
            <PasswordInput
              id={`${portal}-confirm-password`}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Repeat password"
              minLength={10}
              required
            />
          </div>
        </div>

        {message && (
          <p className="flex gap-3 rounded-lg bg-emerald/10 p-3 text-sm font-semibold leading-6 text-emerald">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button className="w-full" type="submit" disabled={loading} variant="emerald" icon={<KeyRound className="size-4" />}>
            {loading ? "Updating" : "Update Password"}
          </Button>
          <ButtonLink className="w-full" href={authPath("/forgot-password", portal)} variant="secondary" icon={<Mail className="size-4" />}>
            Forgot Password
          </ButtonLink>
        </div>
      </form>
    </>
  );

  if (surface === "plain") {
    return <div className={cn(className)}>{content}</div>;
  }

  return (
    <Card className={cn("bg-white", className)}>
      {content}
    </Card>
  );
}
