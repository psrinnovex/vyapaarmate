"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Landmark,
  LoaderCircle,
  MapPinned,
  ShieldCheck,
  UploadCloud,
  Wallet
} from "lucide-react";
import { useDashboardLive } from "@/hooks/use-live-sync";
import { BusinessImageUploadField } from "@/components/dashboard/business-image-upload-field";
import {
  defaultFulfillmentModesForBusinessType,
  fulfillmentLabelForBusinessType,
  fulfillmentModeFlagNames,
  fulfillmentModesFromFlags,
  getBusinessFulfillmentProfile,
  isFulfillmentModeAllowedForBusinessType,
  type ActiveFulfillmentMode
} from "@/lib/business-rules";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { pricingPlans } from "@/lib/constants";
import { formChecked, formNumber, formOptionalNumber, formString } from "@/lib/form-data";
import { cn, formatINR } from "@/lib/utils";
import { ActionNotice, type ActionNoticeState } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BusinessTypeSelect } from "@/components/ui/business-type-select";
import { BusinessHoursEditor } from "@/components/ui/business-hours-editor";
import { EmailInput, PhoneInput } from "@/components/ui/form-fields";
import { BusinessLocationMapPicker } from "@/components/ui/business-location-map-picker";
import { PageHeader } from "@/components/ui/section";
import { DashboardPageSkeleton } from "@/components/ui/skeleton";
import { KycUploadFeedbackDialog, type KycUploadFeedback } from "@/components/dashboard/kyc-upload-feedback-dialog";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";
import { orderAnimationPaths } from "@/lib/order-animations";

type PayoutMethod = "UPI" | "BANK_TRANSFER";
type SetupWizardStepId = "profile" | "location" | "service" | "payout" | "documents";

const setupWizardStepIds: SetupWizardStepId[] = ["profile", "location", "service", "payout", "documents"];
const setupFormStepIds: SetupWizardStepId[] = ["profile", "location", "service", "payout"];

async function readActionError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string") return payload.error;

    if (payload.error && typeof payload.error === "object") {
      const flattened = payload.error as {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
      const errors = [
        ...(flattened.formErrors ?? []),
        ...Object.entries(flattened.fieldErrors ?? {}).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => `${field}: ${message}`)
        )
      ];
      if (errors.length > 0) return errors.join(" ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function readFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPlanName(plan: string) {
  return plan
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function payoutMethodLabel(method: PayoutMethod) {
  return method === "UPI" ? "UPI" : "Bank transfer";
}

export function BusinessSetupPage() {
  const router = useRouter();
  const { data, loading, refresh } = useDashboardLive();
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingKycType, setUploadingKycType] = useState<string | null>(null);
  const [kycUploadFeedback, setKycUploadFeedback] = useState<KycUploadFeedback | null>(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState("");
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<PayoutMethod | null>(null);
  const [pendingLogoImageDataUrl, setPendingLogoImageDataUrl] = useState<string | null | undefined>(undefined);
  const [activeStepId, setActiveStepId] = useState<SetupWizardStepId>("profile");
  const [highestUnlockedStepIndex, setHighestUnlockedStepIndex] = useState(0);
  const [setupFinishedLocally, setSetupFinishedLocally] = useState(false);
  const handleBusinessImageError = useCallback((message: string) => {
    setNotice({ tone: "error", message });
  }, []);

  const business = data.business;
  const billing = data.billing;
  const kyc = data.kyc;
  const setupSaved = Boolean(business.setupCompletedAt) || setupFinishedLocally;
  const hasBusinessPayload = Boolean(business.id);
  const subscriptionActive = billing.status === "ACTIVE";
  const currentPlan = useMemo(() => pricingPlans.find((plan) => plan.id === billing.plan) ?? pricingPlans[0], [billing.plan]);
  const payoutMethod = selectedPayoutMethod ?? business.payoutMethod ?? "UPI";

  useEffect(() => {
    if (loading) return;
    let timer: number | undefined;
    const scrollToVerificationDocuments = () => {
      if (window.location.hash !== "#verification-documents") return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        document.getElementById("verification-documents")?.scrollIntoView({ block: "start" });
      }, 0);
    };

    scrollToVerificationDocuments();
    window.addEventListener("hashchange", scrollToVerificationDocuments);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToVerificationDocuments);
    };
  }, [billing.status, kyc.uploadedDocumentCount, loading]);

  const activeBusinessType = selectedBusinessType || business.businessType;
  const activeCopy = getBusinessConsoleCopy(activeBusinessType);
  const activeFulfillmentProfile = getBusinessFulfillmentProfile(activeBusinessType);
  const businessTypeChanged = Boolean(selectedBusinessType && selectedBusinessType !== business.businessType);
  const selectedFulfillmentModes = businessTypeChanged
    ? defaultFulfillmentModesForBusinessType(activeBusinessType)
    : fulfillmentModesFromFlags({
        businessType: activeBusinessType,
        acceptsPickup: business.acceptsPickup,
        acceptsDineIn: business.acceptsDineIn,
        acceptsServiceAtLocation: business.acceptsServiceAtLocation
      });
  const selectedFulfillmentModeSet = new Set(
    selectedFulfillmentModes.length ? selectedFulfillmentModes : defaultFulfillmentModesForBusinessType(activeBusinessType)
  );
  const wizardSteps = useMemo(
    () => [
      {
        id: "profile" as const,
        label: "Profile",
        title: "Owner and business",
        body: "Confirm the public business identity, owner contact, hours, image, and WhatsApp handoff."
      },
      {
        id: "location" as const,
        label: "Location",
        title: "Business location",
        body: "Set the full service address and pin the exact Google Maps location customers and staff will use."
      },
      {
        id: "service" as const,
        label: `${activeCopy.transactionPlural} and service`,
        title: `${activeCopy.transactionPlural} and service`,
        body: "Choose booking and fulfillment rules that stay ready once admin approval unlocks customer access."
      },
      {
        id: "payout" as const,
        label: payoutMethodLabel(payoutMethod),
        title: "Wallet payout destination",
        body: "Add the verified UPI or bank destination for daily 9 AM wallet payouts."
      },
      {
        id: "documents" as const,
        label: "Documents",
        title: "Document verification",
        body: "Upload the required KYC files and track PSHR admin approval."
      }
    ],
    [activeCopy.transactionPlural, payoutMethod]
  );
  const effectiveActiveStepId: SetupWizardStepId = setupSaved ? "documents" : activeStepId;
  const effectiveHighestUnlockedStepIndex = setupSaved ? setupWizardStepIds.length - 1 : highestUnlockedStepIndex;
  const activeStepIndex = Math.max(0, wizardSteps.findIndex((step) => step.id === effectiveActiveStepId));
  const setupApproved = business.isVerified || kyc.status === "APPROVED";
  const setupWaitingForApproval = kyc.status === "UNDER_REVIEW" || kyc.readyForReview;
  const kycLockedForReview = kyc.status === "UNDER_REVIEW" || kyc.status === "APPROVED";
  const setupProgressPercent = setupApproved
    ? 100
    : setupWaitingForApproval
      ? 92
      : setupSaved
        ? 78
        : Math.round((Math.min(activeStepIndex, setupFormStepIds.length - 1) / (setupWizardStepIds.length - 1)) * 76);
  const setupStatus = setupApproved
    ? { label: "Completed", badge: "emerald" as const }
    : setupWaitingForApproval
      ? { label: "Waiting for admin approval", badge: "purple" as const }
      : setupSaved
        ? { label: "Documents pending", badge: "amber" as const }
        : { label: `Step ${activeStepIndex + 1} of ${setupWizardStepIds.length}`, badge: "blue" as const };
  const pageBody = setupApproved
    ? "Business setup is complete. Customer access can stay live while day-to-day edits move through Settings."
    : setupWaitingForApproval
      ? "Business setup is complete and documents are waiting for PSHR admin approval. The setup form will not reopen."
      : setupSaved
        ? "Business profile, location, booking rules, and payout destination are saved. Complete document verification to finish approval."
        : "Complete one focused step at a time: owner profile, business location, booking and service, payout destination, then document verification.";

  if (loading && !hasBusinessPayload) return <DashboardPageSkeleton variant="settings" />;

  function showStepControlValidity(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    window.setTimeout(() => control.reportValidity(), 0);
  }

  function validateStep(stepId: SetupWizardStepId) {
    if (stepId === "documents") return true;

    const form = formRef.current;
    const stepElement = form?.querySelector<HTMLElement>(`[data-setup-step="${stepId}"]`);
    if (!form || !stepElement) return true;

    const controls = Array.from(stepElement.querySelectorAll("input, select, textarea")).filter(
      (control): control is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
    );

    for (const control of controls) {
      if (control.disabled) continue;
      if (control instanceof HTMLInputElement && control.type === "hidden") continue;
      if (!control.checkValidity()) {
        setActiveStepId(stepId);
        showStepControlValidity(control);
        return false;
      }
    }

    const formData = new FormData(form);

    if (stepId === "location") {
      const latitude = formString(formData, "latitude", "");
      const longitude = formString(formData, "longitude", "");
      if (!latitude || !longitude) {
        setActiveStepId("location");
        setNotice({ tone: "warning", message: "Set the Google Maps pin before continuing." });
        window.setTimeout(() => document.getElementById("setup-location-map")?.scrollIntoView({ block: "center" }), 0);
        return false;
      }
    }

    if (stepId === "service") {
      const businessType = formString(formData, "businessType", activeBusinessType);
      const acceptsPickup =
        isFulfillmentModeAllowedForBusinessType(businessType, "PICKUP") && formChecked(formData, "acceptsPickup");
      const acceptsDineIn =
        isFulfillmentModeAllowedForBusinessType(businessType, "DINE_IN") && formChecked(formData, "acceptsDineIn");
      const acceptsServiceAtLocation =
        isFulfillmentModeAllowedForBusinessType(businessType, "SERVICE_AT_LOCATION") &&
        formChecked(formData, "acceptsServiceAtLocation");
      const serviceRadiusKm = formNumber(formData, "serviceRadiusKm", business.serviceRadiusKm);

      if (!acceptsPickup && !acceptsDineIn && !acceptsServiceAtLocation) {
        setActiveStepId("service");
        setNotice({ tone: "warning", message: "Enable at least one booking or fulfillment option." });
        return false;
      }

      if (acceptsServiceAtLocation && serviceRadiusKm <= 0) {
        setActiveStepId("service");
        setNotice({ tone: "warning", message: "Service radius must be greater than 0 km." });
        return false;
      }
    }

    return true;
  }

  function validateAllSetupSteps() {
    for (const stepId of setupFormStepIds) {
      if (!validateStep(stepId)) return false;
    }
    return true;
  }

  function goToWizardStep(index: number) {
    if (setupSaved && wizardSteps[index]?.id !== "documents") return;
    if (!setupSaved && index > highestUnlockedStepIndex) return;
    const step = wizardSteps[index];
    if (step) setActiveStepId(step.id);
  }

  function goToNextStep() {
    if (activeStepId === "documents") return;
    if (!validateStep(activeStepId)) return;

    if (activeStepId === "payout") {
      formRef.current?.requestSubmit();
      return;
    }

    const nextIndex = Math.min(activeStepIndex + 1, setupWizardStepIds.length - 1);
    setHighestUnlockedStepIndex((current) => Math.max(current, nextIndex));
    setActiveStepId(wizardSteps[nextIndex].id);
  }

  function goToPreviousStep() {
    const previousIndex = Math.max(0, activeStepIndex - 1);
    setActiveStepId(wizardSteps[previousIndex].id);
  }

  async function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateAllSetupSteps()) return;

    const formData = new FormData(event.currentTarget);
    const businessType = formString(formData, "businessType", business.businessType);
    const payload = {
      businessName: formString(formData, "businessName", business.name),
      ownerName: formString(formData, "ownerName", business.ownerName),
      businessType,
      email: formString(formData, "email", business.email),
      phone: formString(formData, "phone", business.phone),
      address: formString(formData, "address", business.address),
      city: formString(formData, "city", business.city),
      state: formString(formData, "state", business.state),
      businessHours: formString(formData, "businessHours", business.hours || "Open today"),
      isOpen: formChecked(formData, "isOpen"),
      minimumOrder: formNumber(formData, "minimumOrder", business.minimumOrder),
      deliveryFee: formNumber(formData, "deliveryFee", business.deliveryFee),
      latitude: formOptionalNumber(formData, "latitude"),
      longitude: formOptionalNumber(formData, "longitude"),
      serviceRadiusKm: formNumber(formData, "serviceRadiusKm", business.serviceRadiusKm),
      acceptsPickup:
        isFulfillmentModeAllowedForBusinessType(businessType, "PICKUP") && formChecked(formData, "acceptsPickup"),
      acceptsDineIn:
        isFulfillmentModeAllowedForBusinessType(businessType, "DINE_IN") && formChecked(formData, "acceptsDineIn"),
      acceptsServiceAtLocation:
        isFulfillmentModeAllowedForBusinessType(businessType, "SERVICE_AT_LOCATION") &&
        formChecked(formData, "acceptsServiceAtLocation"),
      allowsPayLater: formChecked(formData, "allowsPayLater"),
      whatsappEnabled: formChecked(formData, "whatsappEnabled"),
      whatsappDisplayPhone: formString(formData, "whatsappDisplayPhone", business.whatsappDisplayPhone ?? business.phone),
      ...(pendingLogoImageDataUrl === undefined ? {} : { logoImageDataUrl: pendingLogoImageDataUrl }),
      payoutMethod,
      payoutAccountHolderName: formString(formData, "payoutAccountHolderName", business.payoutAccountHolderName ?? business.ownerName),
      payoutUpiId: formString(formData, "payoutUpiId", business.payoutUpiId ?? ""),
      payoutUpiName: formString(formData, "payoutUpiName", business.payoutUpiName ?? business.ownerName),
      payoutBankName: formString(formData, "payoutBankName", business.payoutBankName ?? ""),
      payoutBankAccountNumber: formString(formData, "payoutBankAccountNumber", business.payoutBankAccountNumber ?? ""),
      payoutBankIfsc: formString(formData, "payoutBankIfsc", business.payoutBankIfsc ?? "")
    };

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/dashboard/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const responsePayload = (await response.clone().json().catch(() => ({}))) as { redirectPath?: unknown };

      if (!response.ok) {
        setNotice({
          tone: "error",
          message: await readActionError(response, "Could not save setup. Check profile, map pin, and payout details.")
        });
        return;
      }

      await refresh();
      setSetupFinishedLocally(true);
      setPendingLogoImageDataUrl(undefined);
      setHighestUnlockedStepIndex(setupWizardStepIds.length - 1);
      setActiveStepId("documents");
      window.history.replaceState(null, "", "/dashboard/setup#verification-documents");
      window.setTimeout(() => document.getElementById("verification-documents")?.scrollIntoView({ block: "start" }), 0);
      setNotice({
        tone: "success",
        message: responsePayload.redirectPath === "/dashboard/setup"
          ? "Business setup completed. Upload documents for admin approval."
          : "Business setup saved. Complete billing to unlock document upload."
      });

      if (typeof responsePayload.redirectPath === "string" && responsePayload.redirectPath !== "/dashboard/setup") {
        router.push(responsePayload.redirectPath);
      }
    } catch {
      setNotice({ tone: "error", message: "Could not save setup. Check the connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function uploadKycDocument(event: ChangeEvent<HTMLInputElement>, type: string, label: string) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setUploadingKycType(type);
    setNotice(null);
    setKycUploadFeedback({ status: "uploading", label, fileName: file.name });

    try {
      const dataUrl = await readFileDataUrl(file);
      const response = await fetch("/api/dashboard/kyc/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          dataUrl
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown; kycStatus?: unknown };

      if (!response.ok) {
        setKycUploadFeedback(null);
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : "Could not upload KYC document." });
        return;
      }

      await refresh();
      if (payload.kycStatus === "UNDER_REVIEW") {
        setActiveStepId("documents");
        setNotice({ tone: "success", message: "All documents are submitted. Waiting for PSHR admin approval." });
      }
      setKycUploadFeedback({
        status: "success",
        label,
        fileName: file.name,
        readyForReview: payload.kycStatus === "UNDER_REVIEW" || payload.kycStatus === "APPROVED"
      });
    } catch (uploadError) {
      setKycUploadFeedback(null);
      setNotice({ tone: "error", message: uploadError instanceof Error ? uploadError.message : "Could not upload KYC document." });
    } finally {
      setUploadingKycType(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Business setup"
        body={pageBody}
        action={<Badge variant={setupStatus.badge}>{setupStatus.label}</Badge>}
      />

      <section className="setup-progress-card mb-5 overflow-hidden rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ocean">
              {setupSaved ? "Setup locked in" : wizardSteps[activeStepIndex]?.title}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{setupStatus.label}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <span>{setupProgressPercent}%</span>
            <span className="text-slate-400">complete</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <span className="setup-progress-fill block h-full rounded-full bg-emerald" style={{ width: `${setupProgressPercent}%` }} />
        </div>
      </section>

      <div className="mb-5 grid gap-3 md:grid-cols-5">
        {wizardSteps.map((step, index) => {
          const done = step.id === "documents" ? setupApproved : setupSaved || index < activeStepIndex;
          const active = step.id === effectiveActiveStepId;
          const canActivate = setupSaved ? step.id === "documents" : index <= effectiveHighestUnlockedStepIndex;
          const status = done
            ? "Complete"
            : step.id === "documents" && setupWaitingForApproval
              ? "Admin review"
              : active
                ? "Current"
                : canActivate
                  ? "Ready"
                  : "Locked";
          const icon = step.id === "profile"
            ? <Building2 className="size-4" />
            : step.id === "location"
              ? <MapPinned className="size-4" />
              : step.id === "service"
                ? <CreditCard className="size-4" />
                : step.id === "payout"
                  ? <Wallet className="size-4" />
                  : <ShieldCheck className="size-4" />;

          return (
            <SetupStep
              key={step.id}
              icon={icon}
              label={step.label}
              done={done}
              active={active}
              locked={!canActivate}
              status={status}
              onClick={canActivate ? () => goToWizardStep(index) : undefined}
            />
          );
        })}
      </div>

      {!setupSaved && (
      <form ref={formRef} key={business.id} noValidate className="grid gap-5" onSubmit={submitSetup}>
        <Card data-setup-step="profile" className={cn("setup-wizard-panel", activeStepId !== "profile" && "hidden")}>
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <Building2 className="size-5 text-ocean" />
            Owner and business
          </h2>
          <div className="mt-4 grid gap-4">
            <BusinessImageUploadField
              imageUrl={business.logoUrl}
              disabled={saving}
              onPendingImageChange={setPendingLogoImageDataUrl}
              onError={handleBusinessImageError}
            />
            <div className="grid gap-2">
              <Label>Business name</Label>
              <Input name="businessName" defaultValue={business.name} required />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Owner name</Label>
                <Input name="ownerName" defaultValue={business.ownerName} required />
              </div>
              <div>
                <Label>Business type</Label>
                <BusinessTypeSelect
                  name="businessType"
                  defaultValue={business.businessType}
                  required
                  onChange={(event) => setSelectedBusinessType(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Contact email</Label>
                <EmailInput name="email" defaultValue={business.email} required />
              </div>
              <div>
                <Label>Business phone</Label>
                <PhoneInput name="phone" defaultValue={business.phone} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Business hours</Label>
              <BusinessHoursEditor name="businessHours" defaultValue={business.hours || "Open today"} required />
            </div>
            <div className="grid gap-2">
              <Label>WhatsApp display number</Label>
              <PhoneInput name="whatsappDisplayPhone" defaultValue={business.whatsappDisplayPhone ?? business.phone} />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-mist p-3">
              <span>
                <span className="block text-sm font-bold text-ink">Enable WhatsApp customer flow</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Admin approval is required before live sends.</span>
              </span>
              <input
                name="whatsappEnabled"
                type="checkbox"
                defaultChecked={Boolean(business.whatsappDisplayPhone || business.whatsappConnected || business.whatsappLiveEnabled)}
                className="peer sr-only"
              />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
          </div>
        </Card>

        <Card data-setup-step="location" className={cn("setup-wizard-panel", activeStepId !== "location" && "hidden")}>
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <MapPinned className="size-5 text-emerald" />
            Business location
          </h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label>Address</Label>
              <Textarea name="address" defaultValue={business.address} required />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>City</Label>
                <Input name="city" defaultValue={business.city} required />
              </div>
              <div>
                <Label>State</Label>
                <Input name="state" defaultValue={business.state} required />
              </div>
            </div>
            <div id="setup-location-map">
              <BusinessLocationMapPicker
                key={`${business.id}-${business.latitude ?? "none"}-${business.longitude ?? "none"}`}
                defaultLatitude={business.latitude}
                defaultLongitude={business.longitude}
                address={business.address}
                city={business.city}
                state={business.state}
                businessName={business.name}
              />
            </div>
          </div>
        </Card>

        <Card data-setup-step="service" className={cn("setup-wizard-panel", activeStepId !== "service" && "hidden")}>
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <CreditCard className="size-5 text-ocean" />
            {activeCopy.transactionPlural} and service
          </h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>{activeCopy.minimumValueLabel}</Label>
                <Input name="minimumOrder" type="number" min="0" defaultValue={business.minimumOrder} />
              </div>
              <div>
                <Label>{activeCopy.serviceFeeLabel}</Label>
                <Input name="deliveryFee" type="number" min="0" defaultValue={business.deliveryFee} />
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-line bg-mist p-3">
              <Label>Fulfillment options</Label>
              <div key={activeBusinessType} className="grid gap-3 sm:grid-cols-3">
                {activeFulfillmentProfile.allowedModes.map((mode: ActiveFulfillmentMode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      name={fulfillmentModeFlagNames[mode]}
                      type="checkbox"
                      defaultChecked={selectedFulfillmentModeSet.has(mode)}
                    />
                    {fulfillmentLabelForBusinessType(activeBusinessType, mode)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Service radius in km</Label>
              <Input name="serviceRadiusKm" type="number" min="0" step="0.1" defaultValue={business.serviceRadiusKm} />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-line bg-mist p-3 text-sm font-semibold text-slate-700">
              <input name="allowsPayLater" type="checkbox" defaultChecked={business.allowsPayLater} />
              Allow cash payment
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-mist p-3">
              <span>
                <span className="block text-sm font-bold text-ink">Accept bookings after approval</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Customers only see it while this is on and the business hours above are open.</span>
              </span>
              <input name="isOpen" type="checkbox" defaultChecked={business.isOpen} className="peer sr-only" />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
          </div>
        </Card>

        <Card data-setup-step="payout" className={cn("setup-wizard-panel", activeStepId !== "payout" && "hidden")}>
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <Landmark className="size-5 text-emerald" />
            Wallet payout destination
          </h2>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-mist p-1">
              {(["UPI", "BANK_TRANSFER"] as const).map((method) => {
                const active = payoutMethod === method;
                return (
                  <label
                    key={method}
                    className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold transition ${
                      active ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payoutMethod"
                      value={method}
                      checked={active}
                      className="sr-only"
                      onChange={() => setSelectedPayoutMethod(method)}
                    />
                    {method === "UPI" ? <Wallet className="size-4" /> : <Landmark className="size-4" />}
                    {payoutMethodLabel(method)}
                  </label>
                );
              })}
            </div>
            <div className="grid gap-2">
              <Label>Account holder name</Label>
              <Input name="payoutAccountHolderName" defaultValue={business.payoutAccountHolderName ?? business.ownerName} required />
            </div>
            {payoutMethod === "UPI" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>UPI ID</Label>
                  <Input name="payoutUpiId" defaultValue={business.payoutUpiId ?? ""} placeholder="business@bank" required />
                </div>
                <div>
                  <Label>UPI name</Label>
                  <Input name="payoutUpiName" defaultValue={business.payoutUpiName ?? business.ownerName} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label>Bank name</Label>
                    <Input name="payoutBankName" defaultValue={business.payoutBankName ?? ""} required />
                  </div>
                  <div>
                    <Label>IFSC</Label>
                    <Input name="payoutBankIfsc" defaultValue={business.payoutBankIfsc ?? ""} required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Account number</Label>
                  <Input name="payoutBankAccountNumber" inputMode="numeric" defaultValue={business.payoutBankAccountNumber ?? ""} required />
                </div>
              </div>
            )}
            <div className="rounded-lg border border-emerald/20 bg-emerald/5 p-3 text-sm leading-6 text-slate-700">
              Wallet payouts are sent to this saved destination in the daily 9 AM IST batch, within 24 hours after online payment clears.
            </div>
          </div>
        </Card>

        <div className="setup-wizard-actions flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-sm">
          <Button
            type="button"
            variant="secondary"
            disabled={saving || activeStepIndex === 0}
            icon={<ArrowLeft className="size-4" />}
            onClick={goToPreviousStep}
          >
            Back
          </Button>
          <p className="text-sm font-semibold text-slate-500">
            {activeStepId === "payout"
              ? "Next: document verification"
              : `Next: ${wizardSteps[Math.min(activeStepIndex + 1, setupWizardStepIds.length - 1)]?.title}`}
          </p>
          <Button
            type={activeStepId === "payout" ? "submit" : "button"}
            variant="emerald"
            disabled={saving}
            icon={saving ? <LoaderCircle className="size-4 animate-spin" /> : activeStepId === "payout" ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
            onClick={activeStepId === "payout" ? undefined : goToNextStep}
          >
            {saving ? "Saving setup" : activeStepId === "payout" ? "Save and continue" : "Next"}
          </Button>
        </div>
      </form>
      )}

      {(setupSaved || activeStepId === "documents") && (
      <div className="grid gap-5">
        {setupSaved && (
          <section className="setup-review-card grid gap-4 overflow-hidden rounded-lg border border-line bg-white p-5 shadow-sm lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center">
            <LazyLottieAnimation
              src={setupApproved ? orderAnimationPaths.DELIVERED : setupWaitingForApproval ? orderAnimationPaths.bankVerificationPending : orderAnimationPaths.serviceInProgress}
              label={setupApproved ? "Business setup completed" : setupWaitingForApproval ? "Waiting for admin approval" : "Document verification pending"}
              loop={!setupApproved}
              className="mx-auto size-28 rounded-lg bg-mist lg:mx-0"
              animationClassName="setup-completed-lottie"
              fallback={
                <div className="grid size-20 place-items-center rounded-full border border-emerald/20 bg-emerald/10 text-emerald">
                  {setupApproved ? <CheckCircle2 className="size-10" /> : <ShieldCheck className="size-10" />}
                </div>
              }
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={setupApproved ? "emerald" : setupWaitingForApproval ? "purple" : "amber"}>
                  {setupApproved ? "Completed" : setupWaitingForApproval ? "Admin review" : "Documents pending"}
                </Badge>
                <Badge variant={subscriptionActive ? "emerald" : "amber"}>Subscription {billing.status.replaceAll("_", " ")}</Badge>
              </div>
              <h2 className="mt-3 text-2xl font-extrabold text-ink">
                {setupApproved ? "Business setup completed" : setupWaitingForApproval ? "Waiting for admin approval" : "Setup saved. Documents are next"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {setupApproved
                  ? "PSHR admin approved this business. The setup wizard is finished and will not reopen."
                  : setupWaitingForApproval
                    ? "Owner profile, location, service settings, payout destination, and KYC documents are submitted. Customer access stays hidden until approval."
                    : subscriptionActive
                      ? "The setup form is complete. Upload all required documents to move this business into admin review."
                      : `The setup form is complete. Pay the ${formatPlanName(billing.plan)} plan to unlock document upload.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {!subscriptionActive && (
                <ButtonLink href={`/dashboard/billing/checkout?plan=${billing.plan}`} variant="emerald" icon={<CreditCard className="size-4" />}>
                  Review billing {formatINR(currentPlan.price)}
                </ButtonLink>
              )}
              <ButtonLink href="/dashboard" variant="secondary" icon={<ArrowRight className="size-4" />}>
                Dashboard
              </ButtonLink>
            </div>
          </section>
        )}

      <Card id="verification-documents" className="setup-wizard-panel min-w-0 overflow-hidden scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={subscriptionActive ? "emerald" : "amber"}>Subscription {billing.status.replaceAll("_", " ")}</Badge>
              <Badge variant={kyc.status === "APPROVED" ? "emerald" : kyc.status === "REJECTED" ? "red" : kyc.status === "UNDER_REVIEW" ? "purple" : "amber"}>
                {kyc.label}
              </Badge>
              <Badge variant="blue">{kyc.uploadedDocumentCount}/{kyc.requiredDocumentCount} documents</Badge>
            </div>
            <h2 className="mt-3 text-xl font-bold text-ink">Verification documents</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {setupSaved
                ? subscriptionActive
                  ? setupApproved
                    ? "KYC is approved. Approved documents are kept for admin records."
                    : kyc.status === "REJECTED"
                      ? "Upload corrected documents for another PSHR admin review."
                      : setupWaitingForApproval
                        ? "All required documents are uploaded and waiting for admin approval."
                        : "Upload every required document for admin verification. After approval, the business can go live for customers."
                  : `Pay the ${formatPlanName(billing.plan)} plan to unlock document upload.`
                : "Save the setup form before payment and document upload."}
            </p>
          </div>
          {!subscriptionActive && setupSaved && (
            <ButtonLink
              href={`/dashboard/billing/checkout?plan=${billing.plan}`}
              variant="emerald"
              icon={<CreditCard className="size-4" />}
            >
              Review billing {formatINR(currentPlan.price)}
            </ButtonLink>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {kyc.requiredDocuments.map((requirement) => {
            const document = kyc.documents.find((candidate) => candidate.type === requirement.type);
            const uploading = uploadingKycType === requirement.type;
            const disabled = !setupSaved || !kyc.canUpload || kycLockedForReview || uploadingKycType !== null;
            const uploadLabel = uploading
              ? "Uploading"
              : kycLockedForReview
                ? setupApproved
                  ? "Verified"
                  : "Under Review"
                : document
                  ? "Replace Document"
                  : "Upload Document";

            return (
              <div key={requirement.type} className="min-w-0 overflow-hidden rounded-lg border border-line bg-mist p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink">{requirement.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">{requirement.description}</p>
                  </div>
                  {document ? <FileCheck2 className="size-5 shrink-0 text-emerald" /> : <FileCheck2 className="size-5 shrink-0 text-slate-300" />}
                </div>
                {document && (
                  <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">
                    <p className="block max-w-full truncate font-bold text-ink" title={document.fileName}>{document.fileName}</p>
                    <p>{formatFileSize(document.fileSize)} · {new Date(document.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                )}
                <label
                  className={`mt-4 inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    disabled
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "cursor-pointer bg-black text-white hover:bg-black/90"
                  }`}
                >
                  {uploading ? <LoaderCircle className="size-4 shrink-0 animate-spin" /> : kycLockedForReview ? <FileCheck2 className="size-4 shrink-0" /> : <UploadCloud className="size-4 shrink-0" />}
                  <span className="min-w-0 truncate">{uploadLabel}</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={disabled}
                    onChange={(event) => uploadKycDocument(event, requirement.type, requirement.label)}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </Card>
      </div>
      )}

      <KycUploadFeedbackDialog feedback={kycUploadFeedback} onClose={() => setKycUploadFeedback(null)} />
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function SetupStep({
  icon,
  label,
  done,
  active,
  locked,
  status,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  active: boolean;
  locked: boolean;
  status: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked || !onClick}
      data-active={active}
      className={cn(
        "setup-step-card flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-white p-3 text-left shadow-sm transition",
        active ? "border-ocean/30 ring-4 ring-ocean/10" : "border-line",
        done && "border-emerald/30 bg-emerald/5",
        locked ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:border-ocean/30"
      )}
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", done ? "bg-emerald/10 text-emerald" : active ? "bg-ocean/10 text-ocean" : "bg-slate-100 text-slate-400")}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">{label}</span>
          <span className={cn("mt-0.5 block truncate text-xs font-semibold", done ? "text-emerald" : active ? "text-ocean" : "text-slate-500")}>{status}</span>
        </span>
      </div>
      {done ? <CheckCircle2 className="size-4 shrink-0 text-emerald" /> : <span className="size-2 shrink-0 rounded-full bg-amber-400" />}
    </button>
  );
}
