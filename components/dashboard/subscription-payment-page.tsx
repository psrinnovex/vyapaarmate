"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle
} from "lucide-react";
import { ActionNotice, type ActionNoticeState } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { pricingPlans } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export type SubscriptionPaymentData = {
  subscriptionId: string;
  plan: "STARTER" | "PRO";
  amount: number;
  subtotalAmount: number;
  discountAmount: number;
  upgradeCreditAmount: number;
  upgradedFromSubscriptionId: string | null;
  taxableAmount: number;
  gstRateBps: number;
  gstAmount: number;
  billingGstin: string | null;
  couponCode: string | null;
  status: string;
  paymentState: string;
  paymentProvider: string;
  paymentProviderLabel: string;
  receiverName: string;
  paymentUrl: string | null;
  paymentQrImageUrl: string | null;
  paymentQrExpiresAt: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string;
  failureReason: string | null;
  message: string;
};

type PaymentPayload = Partial<Record<keyof SubscriptionPaymentData, unknown>>;

function checkoutCountdown(seconds: number | null) {
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
}

function formatPlanName(plan: string) {
  return plan
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function nullableStringOr(value: unknown, fallback: string | null) {
  return typeof value === "string" ? value : value === null ? null : fallback;
}

function planOr(value: unknown, fallback: "STARTER" | "PRO") {
  return value === "STARTER" || value === "PRO" ? value : fallback;
}

function numberOr(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function normalizePaymentPayload(payload: PaymentPayload, current: SubscriptionPaymentData): SubscriptionPaymentData {
  return {
    subscriptionId: stringOr(payload.subscriptionId, current.subscriptionId),
    plan: planOr(payload.plan, current.plan),
    amount: numberOr(payload.amount, current.amount),
    subtotalAmount: numberOr(payload.subtotalAmount, current.subtotalAmount),
    discountAmount: numberOr(payload.discountAmount, current.discountAmount),
    upgradeCreditAmount: numberOr(payload.upgradeCreditAmount, current.upgradeCreditAmount),
    upgradedFromSubscriptionId: nullableStringOr(payload.upgradedFromSubscriptionId, current.upgradedFromSubscriptionId),
    taxableAmount: numberOr(payload.taxableAmount, current.taxableAmount),
    gstRateBps: numberOr(payload.gstRateBps, current.gstRateBps),
    gstAmount: numberOr(payload.gstAmount, current.gstAmount),
    billingGstin: nullableStringOr(payload.billingGstin, current.billingGstin),
    couponCode: nullableStringOr(payload.couponCode, current.couponCode),
    status: stringOr(payload.status, current.status),
    paymentState: stringOr(payload.paymentState, current.paymentState),
    paymentProvider: stringOr(payload.paymentProvider, current.paymentProvider),
    paymentProviderLabel: stringOr(payload.paymentProviderLabel, current.paymentProviderLabel),
    receiverName: stringOr(payload.receiverName, current.receiverName),
    paymentUrl: nullableStringOr(payload.paymentUrl, current.paymentUrl),
    paymentQrImageUrl: nullableStringOr(payload.paymentQrImageUrl, current.paymentQrImageUrl),
    paymentQrExpiresAt: nullableStringOr(payload.paymentQrExpiresAt, current.paymentQrExpiresAt),
    invoiceNumber: nullableStringOr(payload.invoiceNumber, current.invoiceNumber),
    invoiceUrl: stringOr(payload.invoiceUrl, current.invoiceUrl),
    failureReason: nullableStringOr(payload.failureReason, current.failureReason),
    message: stringOr(payload.message, current.message)
  };
}

function paymentIsCompleted(payment: SubscriptionPaymentData) {
  return payment.paymentState === "COMPLETED" || payment.status === "ACTIVE";
}

function paymentIsFailed(payment: SubscriptionPaymentData) {
  return payment.paymentState === "FAILED";
}

export function SubscriptionPaymentPage({ initialData }: { initialData: SubscriptionPaymentData }) {
  const router = useRouter();
  const [payment, setPayment] = useState(initialData);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const planDetails = useMemo(() => pricingPlans.find((plan) => plan.id === payment.plan), [payment.plan]);
  const completed = paymentIsCompleted(payment);
  const failed = paymentIsFailed(payment);
  const pending = !completed && !failed;
  const isUpi = payment.paymentProvider === "UPI";
  const isCashfree = payment.paymentProvider === "CASHFREE";
  const displayedRemainingSeconds = pending && payment.paymentQrExpiresAt ? remainingSeconds : null;

  const refreshStatus = useCallback(async (manual = false) => {
    setChecking(true);
    if (manual) setNotice(null);

    try {
      const response = await fetch("/api/dashboard/billing/checkout/" + encodeURIComponent(payment.subscriptionId), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as PaymentPayload & { error?: unknown };

      if (!response.ok) {
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : "Could not refresh payment status." });
        return;
      }

      const nextPayment = normalizePaymentPayload(payload, payment);
      setPayment(nextPayment);

      if (manual) {
        if (paymentIsCompleted(nextPayment)) {
          setNotice({ tone: "success", message: "Subscription payment confirmed. Your plan is active." });
        } else if (paymentIsFailed(nextPayment)) {
          setNotice({ tone: "error", message: nextPayment.failureReason ?? "Subscription payment was not completed." });
        } else {
          setNotice({
            tone: "warning",
            message: nextPayment.paymentProvider === "UPI"
              ? "Payment is still waiting for PSHR Innovex bank verification."
              : "Payment is still waiting for provider confirmation."
          });
        }
      }
    } catch {
      if (manual) setNotice({ tone: "error", message: "Could not refresh payment status. Check the connection and try again." });
    } finally {
      setChecking(false);
    }
  }, [payment]);

  useEffect(() => {
    if (!pending) return;

    const initialTimer = window.setTimeout(() => void refreshStatus(false), 0);
    const timer = window.setInterval(() => void refreshStatus(false), 4000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [pending, refreshStatus]);

  useEffect(() => {
    if (!payment.paymentQrExpiresAt || !pending) return;

    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((new Date(payment.paymentQrExpiresAt ?? "").getTime() - Date.now()) / 1000));
      setRemainingSeconds(Number.isFinite(seconds) ? seconds : null);
    };
    const initialTimer = window.setTimeout(updateRemaining, 0);
    const timer = window.setInterval(updateRemaining, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [payment.paymentQrExpiresAt, pending]);

  async function createFreshCheckout() {
    setRetrying(true);
    setNotice(null);

    try {
      const response = await fetch("/api/dashboard/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: payment.plan, couponCode: payment.couponCode ?? undefined, billingGstin: payment.billingGstin ?? undefined })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown; subscriptionId?: unknown };

      if (!response.ok) {
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : "Could not create a fresh subscription checkout." });
        return;
      }

      if (typeof payload.subscriptionId !== "string") {
        setNotice({ tone: "error", message: "Checkout was created but the payment reference was missing. Please try again." });
        return;
      }

      router.replace("/dashboard/billing/payment/" + encodeURIComponent(payload.subscriptionId));
    } catch {
      setNotice({ tone: "error", message: "Could not create a fresh subscription checkout. Check the connection and try again." });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      <div className="mb-5">
        <Link href="/dashboard/billing" className="inline-flex items-center gap-2 text-sm font-bold text-ocean">
          <ArrowLeft className="size-4" /> Back to billing
        </Link>
      </div>
      <PageHeader
        title="Subscription payment"
        body={"Complete the " + (planDetails?.name ?? formatPlanName(payment.plan)) + " checkout. Subscription access changes only after successful verification."}
        action={<Badge variant={completed ? "emerald" : failed ? "red" : "amber"}>{completed ? "Paid" : failed ? "Retry needed" : "Payment pending"}</Badge>}
      />

      {completed ? (
        <Card className="payment-state-enter border border-emerald/20 bg-emerald/5 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald text-white shadow-glow">
            <CheckCircle2 className="size-9" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-ink">Subscription activated</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{payment.message}</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Next, upload the required verification documents. After PSHR admin approval, the business becomes eligible for public customer access.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/dashboard/setup#verification-documents" variant="emerald" icon={<ShieldCheck className="size-4" />}>
              Continue to verification
            </ButtonLink>
            <ButtonLink href={payment.invoiceUrl} variant="secondary" icon={<ReceiptText className="size-4" />}>
              View invoice
            </ButtonLink>
          </div>
        </Card>
      ) : failed ? (
        <Card className="payment-state-enter border border-red-200 bg-red-50/70 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-red-600 text-white shadow-soft">
            <XCircle className="size-9" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-ink">Payment not completed</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{payment.failureReason ?? payment.message}</p>
          <Button className="mt-5" variant="danger" icon={retrying ? <LoaderCircle className="size-4 animate-spin" /> : <QrCode className="size-4" />} onClick={createFreshCheckout} disabled={retrying}>
            {retrying ? "Creating checkout" : "Create fresh checkout"}
          </Button>
        </Card>
      ) : (
        <Card className="payment-state-enter overflow-hidden border border-emerald/20 bg-gradient-to-br from-emerald/10 via-white to-ocean/5">
          <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="emerald">Payment pending</Badge>
                {!isCashfree && <Badge variant="blue">{payment.paymentProviderLabel}</Badge>}
              </div>
              <h2 className="mt-4 text-2xl font-bold text-ink">{isCashfree ? "Pay Online Now" : "Pay " + payment.receiverName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{payment.message}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-slate-700 shadow-sm">
                  <span className="payment-pulse-dot size-2 rounded-full bg-emerald" /> Awaiting confirmation
                </span>
                {displayedRemainingSeconds !== null && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-slate-700 shadow-sm">
                    <Clock3 className="size-4 text-ocean" /> {displayedRemainingSeconds > 0 ? "Expires in " + checkoutCountdown(displayedRemainingSeconds) : "Checking expiry"}
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-slate-700 shadow-sm">
                  {planDetails?.name ?? formatPlanName(payment.plan)} - {formatINR(payment.amount)}
                </span>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {isUpi
                  ? "After payment, PSHR Innovex verifies the exact bank credit and UTR before activating this subscription."
                  : "Provider confirmation activates this subscription automatically after a successful payment."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {payment.paymentUrl && (
                  <a
                    href={payment.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald px-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald/90"
                  >
                    <Wallet className="size-4" /> {isUpi ? "Open payment app" : isCashfree ? "Open Cashfree checkout" : "Open payment QR"} <ExternalLink className="size-4" />
                  </a>
                )}
                <Button variant="secondary" icon={checking ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} disabled={checking} onClick={() => void refreshStatus(true)}>
                  {checking ? "Checking" : "Check status"}
                </Button>
              </div>
            </div>
            <div className="mx-auto lg:mx-0">
              {payment.paymentQrImageUrl ? (
                <div className="payment-qr-frame rounded-2xl border border-emerald/20 bg-white p-3 shadow-soft">
                  <Image
                    src={payment.paymentQrImageUrl}
                    alt={payment.receiverName + " subscription payment QR"}
                    width={224}
                    height={224}
                    unoptimized
                    className="size-56 rounded-xl bg-white object-contain"
                  />
                  <span className="payment-qr-scanline" aria-hidden="true" />
                </div>
              ) : (
                <div className="grid size-64 place-items-center rounded-2xl border border-emerald/20 bg-white p-6 text-center shadow-soft">
                  <div>
                    <QrCode className="mx-auto size-12 text-ocean" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">Payment link ready</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">Checkout summary</h2>
            <p className="mt-1 text-sm text-slate-600">{payment.invoiceNumber ?? "Subscription invoice"} is tied to this payment reference.</p>
          </div>
          <StatusPill status={payment.paymentState} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-mist p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Plan</p>
            <p className="mt-2 font-bold text-ink">{planDetails?.name ?? formatPlanName(payment.plan)}</p>
          </div>
          <div className="rounded-lg bg-mist p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Final payable</p>
            <p className="mt-2 font-bold text-ink">{formatINR(payment.amount)}</p>
          </div>
          <div className="rounded-lg bg-mist p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Provider</p>
            <p className="mt-2 font-bold text-ink">{payment.paymentProviderLabel}</p>
          </div>
          {payment.billingGstin && (
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">GSTIN</p>
              <p className="mt-2 break-words font-bold text-ink">{payment.billingGstin}</p>
            </div>
          )}
        </div>
        <div className="mt-4 ml-auto max-w-sm border-t border-line pt-3 text-sm">
          <div className="flex justify-between py-1 text-slate-600"><span>Subscription amount</span><span>{formatINR(payment.subtotalAmount)}</span></div>
          {payment.discountAmount > 0 && (
            <div className="flex justify-between py-1 text-emerald"><span>Coupon {payment.couponCode ? `(${payment.couponCode})` : ""}</span><span>-{formatINR(payment.discountAmount)}</span></div>
          )}
          {payment.upgradeCreditAmount > 0 && (
            <div className="flex justify-between py-1 text-emerald"><span>Current subscription credit</span><span>-{formatINR(payment.upgradeCreditAmount)}</span></div>
          )}
          <div className="flex justify-between py-1 text-slate-600"><span>Taxable amount</span><span>{formatINR(payment.taxableAmount)}</span></div>
          <div className="flex justify-between py-1 text-slate-600"><span>GST {(payment.gstRateBps / 100).toFixed(2)}%</span><span>{formatINR(payment.gstAmount)}</span></div>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-bold text-ink"><span>Total paid</span><span>{formatINR(payment.amount)}</span></div>
        </div>
      </Card>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}
