"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  ReceiptText,
  TicketPercent,
  Wallet,
  X
} from "lucide-react";
import { useDashboardLive } from "@/hooks/use-live-sync";
import { ActionNotice, type ActionNoticeState } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/section";
import { pricingPlans } from "@/lib/constants";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { launchMarket, launchSingleCityRestricted, launchOffer } from "@/lib/launch-policy";
import { cn, formatINR } from "@/lib/utils";

export type SubscriptionCheckoutPlanId = (typeof pricingPlans)[number]["id"];

type SubscriptionBillingPreview = {
  plan: SubscriptionCheckoutPlanId;
  coupon: { code: string; description: string | null } | null;
  promotion: { code: string; name: string; discountPercent: number } | null;
  upgradeCredit: {
    amount: number;
    subscriptionId: string;
    plan: SubscriptionCheckoutPlanId;
  } | null;
  breakdown: {
    subtotal: number;
    discount: number;
    upgradeCredit: number;
    taxableAmount: number;
    gstRateBps: number;
    gstAmount: number;
    total: number;
  };
};

type CheckoutPayload = {
  error?: unknown;
  subscriptionId?: unknown;
  paymentUrl?: unknown;
};

type BusinessAddressFields = {
  address: string;
  city: string;
  state: string;
};

type GstinVerificationState =
  | { status: "provider_verified"; businessName: string }
  | { status: "format_valid" }
  | null;

function normalizeSubscriptionCouponInput(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeGstinInput(value: string) {
  return normalizeGstin(value);
}

function errorMessage(payload: { error?: unknown }, fallback: string) {
  if (typeof payload.error === "string") return payload.error;

  if (payload.error && typeof payload.error === "object") {
    const flattened = payload.error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
    const errors = [
      ...(flattened.formErrors ?? []),
      ...Object.entries(flattened.fieldErrors ?? {}).flatMap(([field, messages]) =>
        (messages ?? []).map((message) => `${field}: ${message}`)
      )
    ];
    if (errors.length > 0) return errors.join(" ");
  }

  return fallback;
}

function gstRateLabel(gstRateBps: number) {
  return (gstRateBps / 100).toFixed(2) + "%";
}

function normalizeBusinessAddressFields(fields: BusinessAddressFields): BusinessAddressFields {
  return {
    address: fields.address.trim(),
    city: fields.city.trim(),
    state: fields.state.trim()
  };
}

function businessAddressIsComplete(fields: BusinessAddressFields) {
  const normalized = normalizeBusinessAddressFields(fields);
  return normalized.address.length >= 5 && normalized.city.length >= 2 && normalized.state.length >= 2;
}

function businessAddressLabel(fields: BusinessAddressFields) {
  const normalized = normalizeBusinessAddressFields(fields);
  return [normalized.address, normalized.city, normalized.state].filter(Boolean).join(", ");
}

function businessAddressStateKey(businessId: string, fields: BusinessAddressFields) {
  const normalized = normalizeBusinessAddressFields(fields);
  return [businessId, normalized.address, normalized.city, normalized.state].join("\n");
}

export function SubscriptionCheckoutPage({ initialPlan }: { initialPlan: SubscriptionCheckoutPlanId }) {
  const router = useRouter();
  const { data, refresh } = useDashboardLive();
  const business = data.business;
  const savedBusinessAddress = useMemo(
    () => ({
      address: business.address,
      city: launchSingleCityRestricted ? launchMarket.city : business.city,
      state: launchSingleCityRestricted ? launchMarket.state : business.state
    }),
    [business.address, business.city, business.state]
  );
  const savedBusinessAddressKey = useMemo(
    () => businessAddressStateKey(business.id, savedBusinessAddress),
    [business.id, savedBusinessAddress]
  );
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionCheckoutPlanId>(initialPlan);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [billingGstin, setBillingGstin] = useState("");
  const [businessAddressDraft, setBusinessAddressDraft] = useState(() => ({
    key: businessAddressStateKey(business.id, {
      address: business.address,
      city: launchSingleCityRestricted ? launchMarket.city : business.city,
      state: launchSingleCityRestricted ? launchMarket.state : business.state
    }),
    fields: {
      address: business.address,
      city: launchSingleCityRestricted ? launchMarket.city : business.city,
      state: launchSingleCityRestricted ? launchMarket.state : business.state
    }
  }));
  const [businessAddressEditorOpen, setBusinessAddressEditorOpen] = useState(false);
  const [basePreview, setBasePreview] = useState<SubscriptionBillingPreview | null>(null);
  const [couponPreview, setCouponPreview] = useState<SubscriptionBillingPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [savingBusinessAddress, setSavingBusinessAddress] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);

  const [gstinVerification, setGstinVerification] = useState<GstinVerificationState>(null);
  const [verifyingGstin, setVerifyingGstin] = useState(false);

  const basePreviewRequestId = useRef(0);
  const couponPreviewRequestId = useRef(0);
  const gstinVerifyRequestId = useRef(0);
  const selectedPlanRef = useRef(selectedPlan);

  const selectedPlanDetails = useMemo(
    () => pricingPlans.find((plan) => plan.id === selectedPlan) ?? pricingPlans[0],
    [selectedPlan]
  );
  const billingPreview = couponPreview ?? basePreview;
  const appliedCouponCode = couponPreview?.coupon?.code ?? null;
  const totalPayable = billingPreview?.breakdown.total ?? selectedPlanDetails.price;
  const normalizedBillingGstin = normalizeGstinInput(billingGstin);
  const billingGstinIsInvalid = Boolean(normalizedBillingGstin) && !isValidGstin(normalizedBillingGstin);

  const businessAddressFields = businessAddressDraft.key === savedBusinessAddressKey
    ? businessAddressDraft.fields
    : savedBusinessAddress;
  const savedBusinessAddressComplete = businessAddressIsComplete(savedBusinessAddress);
  const businessAddressFormOpen = businessAddressEditorOpen || !savedBusinessAddressComplete;
  const editedBusinessAddressComplete = businessAddressIsComplete(businessAddressFields);
  const savedBusinessAddressLabel = businessAddressLabel(savedBusinessAddress);

  useEffect(() => {
    selectedPlanRef.current = selectedPlan;
  }, [selectedPlan]);

  const loadBasePreview = useCallback(async (plan: SubscriptionCheckoutPlanId, gstin: string | undefined) => {
    const requestId = ++basePreviewRequestId.current;
    setLoadingPreview(true);
    setBasePreview(null);

    try {
      const response = await fetch("/api/dashboard/billing/checkout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingGstin: gstin })
      });
      const payload = (await response.json().catch(() => ({}))) as SubscriptionBillingPreview & { error?: unknown };

      if (basePreviewRequestId.current !== requestId || selectedPlanRef.current !== plan) return;

      if (!response.ok) {
        setNotice({ tone: "error", message: errorMessage(payload, "Could not load billing details.") });
        return;
      }

      setBasePreview(payload);
    } catch {
      if (basePreviewRequestId.current === requestId && selectedPlanRef.current === plan) {
        setNotice({ tone: "error", message: "Could not load billing details. Check the connection and try again." });
      }
    } finally {
      if (basePreviewRequestId.current === requestId && selectedPlanRef.current === plan) {
        setLoadingPreview(false);
      }
    }
  }, []);

  const verifyGstin = useCallback(async (gstin: string) => {
    const requestId = ++gstinVerifyRequestId.current;
    setVerifyingGstin(true);
    setGstinVerification(null);

    try {
      const response = await fetch("/api/dashboard/billing/checkout/gstin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        formatValid?: unknown;
        providerVerified?: unknown;
        businessName?: unknown;
      };

      if (gstinVerifyRequestId.current !== requestId) return;
      if (!response.ok || payload.formatValid !== true) {
        setGstinVerification(null);
        return;
      }

      const businessName = typeof payload.businessName === "string" ? payload.businessName.trim() : "";
      setGstinVerification(
        payload.providerVerified === true && businessName
          ? { status: "provider_verified", businessName }
          : { status: "format_valid" }
      );
    } catch {
      if (gstinVerifyRequestId.current === requestId) {
        setGstinVerification({ status: "format_valid" });
      }
    } finally {
      if (gstinVerifyRequestId.current === requestId) {
        setVerifyingGstin(false);
      }
    }
  }, []);

  useEffect(() => {
    const gstin = billingGstinIsInvalid ? undefined : normalizedBillingGstin || undefined;
    const timer = window.setTimeout(() => void loadBasePreview(selectedPlan, gstin), 0);
    return () => window.clearTimeout(timer);
  }, [loadBasePreview, selectedPlan, billingGstinIsInvalid, normalizedBillingGstin]);

  useEffect(() => {
    if (normalizedBillingGstin && !billingGstinIsInvalid) {
      const timer = window.setTimeout(() => void verifyGstin(normalizedBillingGstin), 500);
      return () => window.clearTimeout(timer);
    } else {
      const timer = window.setTimeout(() => {
        setGstinVerification(null);
        setVerifyingGstin(false);
      }, 0);
      gstinVerifyRequestId.current += 1;
      return () => window.clearTimeout(timer);
    }
  }, [verifyGstin, normalizedBillingGstin, billingGstinIsInvalid]);

  function choosePlan(plan: SubscriptionCheckoutPlanId) {
    selectedPlanRef.current = plan;
    couponPreviewRequestId.current += 1;
    setSelectedPlan(plan);
    setPlanPickerOpen(false);
    setCouponCode("");
    setCouponPreview(null);
    setCheckingCoupon(false);
    setNotice(null);
  }

  function updateBusinessAddressField(field: keyof BusinessAddressFields, value: string) {
    setBusinessAddressDraft((current) => {
      const fields = current.key === savedBusinessAddressKey ? current.fields : savedBusinessAddress;
      return {
        key: savedBusinessAddressKey,
        fields: { ...fields, [field]: value }
      };
    });
  }

  async function saveBusinessAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = normalizeBusinessAddressFields(businessAddressFields);

    if (!businessAddressIsComplete(payload)) {
      setNotice({ tone: "warning", message: "Enter the full business address, city, and state before saving." });
      return;
    }

    setSavingBusinessAddress(true);
    setNotice(null);

    try {
      const response = await fetch("/api/dashboard/billing/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const responsePayload = (await response.json().catch(() => ({}))) as { error?: unknown };

      if (!response.ok) {
        setNotice({ tone: "error", message: errorMessage(responsePayload, "Could not save business address.") });
        return;
      }

      setBusinessAddressDraft({
        key: savedBusinessAddressKey,
        fields: payload
      });
      await refresh();
      setBusinessAddressEditorOpen(false);
      setNotice({ tone: "success", message: "Business address saved for subscription billing." });
    } catch {
      setNotice({ tone: "error", message: "Could not save business address. Check the connection and try again." });
    } finally {
      setSavingBusinessAddress(false);
    }
  }

  async function applyCoupon() {
    const code = normalizeSubscriptionCouponInput(couponCode);
    if (!code) {
      setCouponPreview(null);
      setNotice({ tone: "warning", message: "Enter a subscription coupon code first." });
      return;
    }

    const planAtRequest = selectedPlan;
    const requestId = ++couponPreviewRequestId.current;
    setCheckingCoupon(true);
    setNotice(null);

    try {
      const response = await fetch("/api/dashboard/billing/checkout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planAtRequest, couponCode: code, billingGstin: billingGstinIsInvalid ? undefined : normalizedBillingGstin || undefined })
      });
      const payload = (await response.json().catch(() => ({}))) as SubscriptionBillingPreview & { error?: unknown };

      if (couponPreviewRequestId.current !== requestId || selectedPlanRef.current !== planAtRequest) return;

      if (!response.ok) {
        setCouponPreview(null);
        setNotice({ tone: "error", message: errorMessage(payload, "Could not apply this subscription coupon.") });
        return;
      }

      setCouponPreview(payload);
      setCouponCode(payload.coupon?.code ?? code);
      setNotice({ tone: "success", message: `Coupon ${payload.coupon?.code ?? code} applied to this subscription.` });
    } catch {
      if (couponPreviewRequestId.current === requestId && selectedPlanRef.current === planAtRequest) {
        setNotice({ tone: "error", message: "Could not check this coupon. Check the connection and try again." });
      }
    } finally {
      if (couponPreviewRequestId.current === requestId && selectedPlanRef.current === planAtRequest) {
        setCheckingCoupon(false);
      }
    }
  }

  async function continueToPayment() {
    if (!savedBusinessAddressComplete) {
      setBusinessAddressEditorOpen(true);
      setNotice({ tone: "warning", message: "Save the business address before continuing to payment." });
      return;
    }

    const enteredCouponCode = normalizeSubscriptionCouponInput(couponCode);
    if (enteredCouponCode && enteredCouponCode !== appliedCouponCode) {
      setNotice({ tone: "warning", message: "Apply the subscription coupon before continuing, or clear it to pay without a coupon." });
      return;
    }

    if (billingGstinIsInvalid) {
      setNotice({ tone: "error", message: "Enter a valid GSTIN with the correct check digit, or leave it blank." });
      return;
    }

    setCreatingCheckout(true);
    setNotice(null);
    let shouldResetCreating = true;

    try {
      const response = await fetch("/api/dashboard/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          couponCode: appliedCouponCode ?? undefined,
          billingGstin: normalizedBillingGstin || undefined
        })
      });
      const payload = (await response.json().catch(() => ({}))) as CheckoutPayload;

      if (!response.ok) {
        setNotice({ tone: "error", message: errorMessage(payload, "Could not create subscription checkout.") });
        return;
      }

      if (typeof payload.subscriptionId !== "string") {
        setNotice({ tone: "error", message: "Checkout was created but the payment reference was missing. Please try again." });
        return;
      }

      shouldResetCreating = false;
      if (typeof payload.paymentUrl === "string" && payload.paymentUrl) {
        window.location.assign(payload.paymentUrl);
        return;
      }

      router.push("/dashboard/billing/payment/" + encodeURIComponent(payload.subscriptionId));
    } catch {
      setNotice({ tone: "error", message: "Could not create subscription checkout. Check the connection and try again." });
    } finally {
      if (shouldResetCreating) setCreatingCheckout(false);
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
        title="Subscription checkout"
        body="Review the plan, apply an eligible coupon, and confirm the final payable amount."
        action={<Badge variant="blue">Secure checkout</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-5">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">Selected plan</h2>
              <Badge variant="purple">{selectedPlanDetails.name} selected</Badge>
            </div>
            <div className="rounded-lg border border-emerald bg-white p-4 shadow-soft ring-4 ring-emerald/10 transition-all duration-300 ease-out">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-ink">{selectedPlanDetails.name}</h3>
                    <Badge variant="emerald">Selected</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{selectedPlanDetails.bestFor}</p>
                </div>
                <button
                  type="button"
                  aria-label={planPickerOpen ? "Close plan selector" : "Edit selected plan"}
                  title={planPickerOpen ? "Close plan selector" : "Edit selected plan"}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-mist text-slate-700 transition hover:border-ocean/30 hover:bg-white hover:text-ocean focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean/15"
                  onClick={() => setPlanPickerOpen((open) => !open)}
                >
                  {planPickerOpen ? <X className="size-4" /> : <Pencil className="size-4" />}
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-mist p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Monthly amount</p>
                  <p className="mt-1 text-2xl font-extrabold text-ink">
                    {formatINR(selectedPlanDetails.price)}<span className="text-sm font-medium text-slate-500">/month</span>
                  </p>
                </div>
                <div className="rounded-lg bg-mist p-3 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Included</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{selectedPlanDetails.features.slice(0, 2).join(" · ")}</p>
                </div>
              </div>
              <div
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-out",
                  planPickerOpen ? "mt-4 grid-rows-[1fr] translate-y-0 opacity-100" : "mt-0 grid-rows-[0fr] -translate-y-1 opacity-0"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="grid items-start gap-4 md:grid-cols-2">
                    {pricingPlans.map((plan) => {
                      const selected = selectedPlan === plan.id;
                      const isProActive = business.subscriptionPlan === "PRO" && business.subscriptionStatus !== "CANCELLED";
                      const blockStarter = plan.id === "STARTER" && isProActive;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={blockStarter}
                          className={cn(
                            "flex min-h-[320px] transform-gpu flex-col overflow-hidden rounded-lg border bg-white p-5 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-ocean/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean/20",
                            selected && "border-emerald bg-emerald/5 shadow-soft ring-4 ring-emerald/10",
                            !selected && "border-line",
                            blockStarter && "opacity-75 grayscale cursor-not-allowed hover:-translate-y-0 hover:border-line"
                          )}
                          onClick={() => !blockStarter && choosePlan(plan.id)}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-xl font-bold text-ink">{plan.name}</span>
                            <Badge variant={selected ? "emerald" : blockStarter ? "secondary" : "blue"}>
                              {selected ? "Selected" : blockStarter ? "Unavailable" : "Choose"}
                            </Badge>
                          </span>
                          <span className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</span>
                          <span className="mt-4 text-3xl font-extrabold text-ink">
                            {formatINR(plan.price)}<span className="text-sm font-medium text-slate-500">/month</span>
                          </span>
                          {launchOffer.publiclyAdvertised && (
                            <span className="mt-1 text-xs font-semibold text-slate-500">
                              <span className="line-through">{formatINR(plan.listPrice)}</span>{" "}
                              <span className="text-emerald">{launchOffer.discountLabel} for the Bengaluru launch</span>
                            </span>
                          )}
                          <span className="mt-2 text-sm font-semibold text-slate-600">{plan.bestFor}</span>
                          <span className="mt-4 grid flex-1 gap-2">
                            {plan.features.slice(0, 5).map((feature) => (
                              <span key={feature} className="flex gap-2 text-sm leading-5 text-slate-700">
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald" />
                                <span>{feature}</span>
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-ink">Billing details</h2>
              </div>
              <Badge variant={appliedCouponCode ? "emerald" : "amber"}>{appliedCouponCode ? "Coupon applied" : "Coupon optional"}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-mist p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Building2 className="size-4 text-ocean" /> Bill to
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{business.name}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{business.ownerName}</p>
              </div>
              <div className="rounded-lg bg-mist p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Mail className="size-4 text-violet" /> Contact
                </div>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">{business.email}</p>
                <p className="text-sm leading-6 text-slate-600">{business.phone}</p>
              </div>
              <div className="rounded-lg bg-mist p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <ReceiptText className="size-4 text-ocean" /> Subscription
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedPlanDetails.name} monthly plan for the business account.</p>
              </div>
              <div className="rounded-lg bg-mist p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <TicketPercent className="size-4 text-amber-600" /> Coupon
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Apply one valid subscription coupon before continuing.</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-line bg-mist p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    <MapPin className="size-4 text-ocean" /> Business address
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Required for subscription invoices and payment records.
                  </p>
                </div>
                {savedBusinessAddressComplete && (
                  <button
                    type="button"
                    aria-label={businessAddressFormOpen ? "Close address editor" : "Edit business address"}
                    title={businessAddressFormOpen ? "Close address editor" : "Edit business address"}
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-slate-700 transition hover:border-ocean/30 hover:text-ocean focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ocean/15"
                    onClick={() => setBusinessAddressEditorOpen((open) => !open)}
                  >
                    {businessAddressFormOpen ? <X className="size-4" /> : <Pencil className="size-4" />}
                  </button>
                )}
              </div>

              {savedBusinessAddressComplete && (
                <div
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-out",
                    businessAddressFormOpen ? "mt-0 max-h-0 -translate-y-1 opacity-0" : "mt-3 max-h-32 translate-y-0 opacity-100"
                  )}
                >
                  <p className="text-sm font-semibold leading-6 text-ink">{savedBusinessAddressLabel}</p>
                </div>
              )}

              <div
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-out",
                  businessAddressFormOpen ? "mt-3 grid-rows-[1fr] translate-y-0 opacity-100" : "mt-0 grid-rows-[0fr] -translate-y-1 opacity-0"
                )}
              >
                <form className="grid min-h-0 gap-3 overflow-hidden" onSubmit={saveBusinessAddress}>
                  <div>
                    <Label htmlFor="subscriptionBusinessAddress">Address</Label>
                    <Textarea
                      id="subscriptionBusinessAddress"
                      className="mt-2 min-h-20 bg-white"
                      value={businessAddressFields.address}
                      onChange={(event) => updateBusinessAddressField("address", event.currentTarget.value)}
                      placeholder="Shop number, street, landmark"
                      autoComplete="street-address"
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="subscriptionBusinessCity">City</Label>
                      <Input
                        id="subscriptionBusinessCity"
                        className="mt-2 bg-white"
                        value={businessAddressFields.city}
                        onChange={(event) => updateBusinessAddressField("city", event.currentTarget.value)}
                        readOnly={launchSingleCityRestricted}
                        placeholder="City"
                        autoComplete="address-level2"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="subscriptionBusinessState">State</Label>
                      <Input
                        id="subscriptionBusinessState"
                        className="mt-2 bg-white"
                        value={businessAddressFields.state}
                        onChange={(event) => updateBusinessAddressField("state", event.currentTarget.value)}
                        readOnly={launchSingleCityRestricted}
                        placeholder="State"
                        autoComplete="address-level1"
                        required
                      />
                    </div>
                  </div>
                  {launchSingleCityRestricted && (
                    <p className="text-xs font-semibold text-emerald">
                      Business onboarding is currently limited to {launchMarket.displayName}, {launchMarket.state}.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {!savedBusinessAddressComplete && (
                      <p className="text-xs font-semibold text-amber-700">Save this address before opening payment.</p>
                    )}
                    <Button
                      type="submit"
                      variant="emerald"
                      className="w-full sm:ml-auto sm:w-auto"
                      disabled={savingBusinessAddress || !editedBusinessAddressComplete}
                      icon={savingBusinessAddress ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    >
                      {savingBusinessAddress ? "Saving" : "Save address"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor="subscriptionBillingGstin">Business GSTIN (optional)</Label>
                <div className="relative mt-2">
                  <Input
                    id="subscriptionBillingGstin"
                    value={billingGstin}
                    onChange={(event) => {
                      gstinVerifyRequestId.current += 1;
                      setGstinVerification(null);
                      setBillingGstin(event.currentTarget.value.toUpperCase());
                    }}
                    onBlur={(event) => setBillingGstin(normalizeGstinInput(event.currentTarget.value))}
                    placeholder="29ABCDE1234F1ZW"
                    maxLength={20}
                    autoComplete="off"
                    aria-invalid={billingGstinIsInvalid}
                  />
                  {verifyingGstin && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoaderCircle className="size-4 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
                {billingGstinIsInvalid ? (
                  <p className="mt-2 text-xs font-semibold text-red-600">Enter a valid GSTIN with the correct check digit.</p>
                ) : gstinVerification?.status === "provider_verified" ? (
                  <p className="mt-2 text-xs font-semibold text-emerald">
                    Provider verified: {gstinVerification.businessName}
                  </p>
                ) : normalizedBillingGstin && !verifyingGstin ? (
                  <p className="mt-2 text-xs font-semibold leading-5 text-amber-700">
                    Format valid; provider verification is not confirmed. The GSTIN can still be applied to this invoice.
                  </p>
                ) : null}
              </div>
              {basePreview?.promotion ? (
                <div className="rounded-lg border border-emerald/20 bg-emerald/10 p-3">
                  <p className="text-sm font-bold text-emerald">{basePreview.promotion.name} applied automatically</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {basePreview.promotion.discountPercent}% is deducted before GST. Coupons cannot be combined with this launch price.
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="subscriptionCheckoutCoupon">Subscription coupon</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row lg:flex-col 2xl:flex-row">
                    <Input
                      id="subscriptionCheckoutCoupon"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.currentTarget.value.toUpperCase());
                        setCouponPreview(null);
                      }}
                      placeholder="COUPONCODE"
                      maxLength={32}
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      icon={checkingCoupon ? <LoaderCircle className="size-4 animate-spin" /> : <TicketPercent className="size-4" />}
                      disabled={checkingCoupon || loadingPreview || creatingCheckout}
                      onClick={applyCoupon}
                    >
                      {checkingCoupon ? "Checking" : "Apply"}
                    </Button>
                  </div>
                  {appliedCouponCode && (
                    <p className="mt-2 text-xs font-semibold text-emerald">
                      Coupon {appliedCouponCode} applied{couponPreview?.coupon?.description ? `: ${couponPreview.coupon.description}` : "."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">Payment summary</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedPlanDetails.name} subscription</p>
            </div>
            <Badge variant={loadingPreview ? "amber" : "blue"}>{loadingPreview ? "Updating" : "Ready"}</Badge>
          </div>

          {billingPreview ? (
            <div className="mt-5 grid gap-2 text-sm">
              <div className="flex justify-between gap-3 text-slate-600">
                <span>Subscription amount</span>
                <span>{formatINR(billingPreview.breakdown.subtotal)}</span>
              </div>
              {billingPreview.breakdown.discount > 0 && (
                <div className="flex justify-between gap-3 text-emerald">
                  <span>
                    {billingPreview.promotion?.name ?? "Coupon"}{billingPreview.coupon?.code ? ` (${billingPreview.coupon.code})` : ""}
                  </span>
                  <span>-{formatINR(billingPreview.breakdown.discount)}</span>
                </div>
              )}
              {billingPreview.breakdown.upgradeCredit > 0 && (
                <div className="flex justify-between gap-3 text-emerald">
                  <span>
                    Current {billingPreview.upgradeCredit?.plan === "STARTER" ? "Starter" : "subscription"} credit
                  </span>
                  <span>-{formatINR(billingPreview.breakdown.upgradeCredit)}</span>
                </div>
              )}

              <div className="flex justify-between gap-3 text-slate-600">
                <span>GST {gstRateLabel(billingPreview.breakdown.gstRateBps)}</span>
                <span>{formatINR(billingPreview.breakdown.gstAmount)}</span>
              </div>
              {normalizedBillingGstin && !billingGstinIsInvalid && (
                <p className="pt-1 text-xs font-semibold text-slate-600">
                  GSTIN entered for B2B billing{gstinVerification?.status === "provider_verified" ? " and provider verified" : "; provider verification is not confirmed"}.
                </p>
              )}
              <div className="mt-3 flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
                <span>Total payable</span>
                <span>{formatINR(billingPreview.breakdown.total)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex min-h-40 items-center justify-center gap-2 rounded-lg bg-mist text-sm font-semibold text-slate-500">
              {loadingPreview && <LoaderCircle className="size-4 animate-spin" />}
              {loadingPreview ? "Loading billing details" : "Billing details are unavailable"}
            </div>
          )}

          <Button
            className="mt-5 w-full"
            variant="emerald"
            icon={creatingCheckout ? <LoaderCircle className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            disabled={creatingCheckout || loadingPreview || !billingPreview || !savedBusinessAddressComplete}
            onClick={continueToPayment}
          >
            {!savedBusinessAddressComplete
              ? "Save address to continue"
              : creatingCheckout
                ? "Opening payment"
                : `Continue to payment ${formatINR(totalPayable)}`}
          </Button>
        </Card>
      </div>

      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}
