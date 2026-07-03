"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  CircleX,
  ClipboardList,
  CreditCard,
  EllipsisVertical,
  ExternalLink,
  FileCheck2,
  FileClock,
  KeyRound,
  Megaphone,
  MessageCircle,
  Pencil,
  Power,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TicketPercent,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet
} from "lucide-react";
import { createPortal } from "react-dom";
import { useAdminLive, useStreamRefresh } from "@/hooks/use-live-sync";
import type { LiveAdminBusiness, LiveAdminLog, LiveAdminPayload } from "@/lib/live-types";
import {
  filterFulfillmentFlagsForBusinessType,
  fulfillmentLabelForBusinessType,
  fulfillmentModeFlagNames,
  fulfillmentModesFromFlags,
  getBusinessFulfillmentProfile,
  type ActiveFulfillmentMode
} from "@/lib/business-rules";
import { fulfillmentModeIcons, getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { pricingPlans } from "@/lib/constants";
import { cn, formatINR, formatCompact } from "@/lib/utils";
import { downloadCsv } from "@/lib/client-export";
import { formChecked, formNumber, formOptionalNumber, formString } from "@/lib/form-data";
import { supportBotGuardrails, supportChatbotIntents, supportEscalationRules, supportReplyWordLimit } from "@/lib/support-chatbot";
import { maskEmail, maskPhone } from "@/lib/privacy";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { ActionDialog, ActionNotice, type ActionNoticeState } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { Card, GlassPanel } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BusinessLocationMapPicker } from "@/components/ui/business-location-map-picker";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/section";
import { DashboardPageSkeleton, Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Badge } from "@/components/ui/badge";
import { PaginationControls, usePaginatedItems } from "@/components/ui/pagination";
import { PaymentStatusAnimation } from "@/components/ui/payment-status-animation";

type BusinessAction = "approve" | "reject" | "unapprove" | "suspend" | "open" | "close" | "approveWhatsapp" | "disableWhatsapp" | "delete";
type BusinessFilters = {
  search: string;
  plan: string;
  status: string;
};

type BusinessServiceAreaPayload = {
  latitude?: number;
  longitude?: number;
  serviceRadiusKm: number;
  serviceVisitFee: number;
  acceptsPickup: boolean;
  acceptsDineIn: boolean;
  acceptsServiceAtLocation: boolean;
};

type BusinessWhatsappSetupPayload = {
  whatsappDisplayPhone: string;
  whatsappPhoneNumberId: string;
  whatsappWabaId: string;
  whatsappAccessToken: string;
};

type BusinessPayoutSetupPayload = {
  platformFeeBps: number;
};

type SupportTicket = {
  id: string;
  code: string;
  subject: string;
  description: string;
  businessName: string;
  businessPhone: string | null;
  businessEmail: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterBusinessName: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN_REVIEW" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
  intent: string;
  source: "CHATBOT" | "PAYMENT_DESK" | "ADMIN" | "EMAIL";
  portal: string;
  path: string | null;
  lastMessage: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  feedback: {
    rating: number;
    comment: string | null;
    submittedAt: string;
  } | null;
  safeHandlingNote: string;
  firstResponseDueAt: string | null;
  slaLabel: string;
  isOverdue: boolean;
  orderReference: string | null;
  paymentReference: string | null;
  messageCount: number;
  messages: SupportTicketMessage[];
  createdAt: string;
  lastMessageAt: string;
};

type SupportTicketStatus = SupportTicket["status"];
type AgentReplyStatus = Extract<SupportTicketStatus, "IN_REVIEW" | "WAITING_ON_CUSTOMER" | "RESOLVED">;

type SupportTicketMessage = {
  id: string;
  sender: "CUSTOMER" | "BOT" | "AGENT" | "SYSTEM";
  body: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
};

type SupportAgent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "SUPER_ADMIN" | "SUPPORT_AGENT";
  createdAt: string;
  rating: {
    average: number | null;
    count: number;
  };
};

type SupportAgentInviteState =
  | { status: "sent" | "placeholder"; devInviteUrl?: string }
  | { status: "failed"; error: string };

type SupportAgentActionResponse = {
  agent?: SupportAgent;
  invite?: SupportAgentInviteState;
  deletedId?: string;
  error?: unknown;
};

type SupportMetrics = {
  total: number;
  open: number;
  highPriority: number;
  waiting: number;
  overdue: number;
};

type PendingPlatformUpiPayment = {
  id: string;
  orderNumber: string;
  orderUrl: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: "PENDING" | "FAILED";
  expiresAt: string | null;
  createdAt: string;
};

type BusinessPayoutEmailResponse =
  | { status: "queued" | "placeholder"; to: string }
  | { status: "skipped"; reason: "payout_not_found" | "missing_business_email" }
  | { status: "failed"; to: string; reason: string };

type BusinessPayoutEmailSkipReason = Extract<BusinessPayoutEmailResponse, { status: "skipped" }>["reason"];

type BusinessPayoutActionResponse = {
  payoutEmail?: BusinessPayoutEmailResponse;
};

type PendingSubscriptionUpiPayment = {
  id: string;
  reference: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  plan: "STARTER" | "PRO";
  amount: number;
  paymentState: "PENDING" | "FAILED";
  expiresAt: string | null;
  createdAt: string;
};

type PlatformPaymentSettingsForm = {
  directUpiEnabled: boolean;
  upiId: string | null;
  upiName: string;
  gatewayProvider: "CASHFREE";
  activeProvider: "CASHFREE" | "UPI";
  updatedAt: string | null;
};

type CouponStatusFilter = "" | "ACTIVE" | "INACTIVE";
type CouponDiscountTypeFilter = "" | "PERCENTAGE" | "FIXED_AMOUNT";
type SubscriptionCouponPlanFilter = "" | "ALL_PLANS" | "STARTER" | "PRO";
type BusinessCouponAvailabilityFilter = "" | "PUBLIC" | "NOT_LIVE";
type CouponView = "subscription" | "customer";
type SubscriptionCouponSort =
  | "created_desc"
  | "created_asc"
  | "code_asc"
  | "code_desc"
  | "discount_desc"
  | "discount_asc"
  | "usage_desc"
  | "usage_asc"
  | "expires_asc";
type BusinessCouponSort = SubscriptionCouponSort | "business_asc" | "business_desc";

type SubscriptionCouponFilters = {
  search: string;
  status: CouponStatusFilter;
  plan: SubscriptionCouponPlanFilter;
  discountType: CouponDiscountTypeFilter;
  sort: SubscriptionCouponSort;
};

type BusinessCouponFilters = {
  search: string;
  status: CouponStatusFilter;
  businessId: string;
  availability: BusinessCouponAvailabilityFilter;
  discountType: CouponDiscountTypeFilter;
  sort: BusinessCouponSort;
};

type PlatformSubscriptionCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minimumAmount: number;
  plan: "STARTER" | "PRO" | null;
  redemptionLimit: number | null;
  redeemedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

type AdminCouponBusiness = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  phone: string;
  isActive: boolean;
  isVerified: boolean;
  subscriptionStatus: string;
  kycStatus: string;
};

type AdminBusinessCoupon = {
  id: string;
  businessId: string;
  business: Pick<AdminCouponBusiness, "id" | "name" | "slug" | "ownerName" | "phone">;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minimumOrderAmount: number;
  redemptionLimit: number | null;
  redeemedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

async function fetchPendingPlatformUpiPayments() {
  const response = await fetch("/api/admin/payments/upi", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load pending PSHR UPI payments.");
  const payload = (await response.json()) as { payments?: PendingPlatformUpiPayment[] };
  return payload.payments ?? [];
}

async function fetchPlatformPaymentSettings() {
  const response = await fetch("/api/admin/payment-settings", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load platform payment settings.");
  return (await response.json()) as PlatformPaymentSettingsForm;
}

async function fetchPlatformSubscriptionCoupons() {
  const response = await fetch("/api/admin/subscription-coupons", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load subscription coupons.");
  const payload = (await response.json()) as { coupons?: PlatformSubscriptionCoupon[] };
  return payload.coupons ?? [];
}

async function fetchAdminBusinessCoupons() {
  const response = await fetch("/api/admin/business-coupons", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load customer checkout coupons.");
  const payload = (await response.json()) as {
    coupons?: AdminBusinessCoupon[];
    businesses?: AdminCouponBusiness[];
  };
  return {
    coupons: payload.coupons ?? [],
    businesses: payload.businesses ?? []
  };
}

async function fetchPendingSubscriptionUpiPayments() {
  const response = await fetch("/api/admin/subscriptions/upi", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load pending subscription UPI payments.");
  const payload = (await response.json()) as {
    subscriptions?: PendingSubscriptionUpiPayment[];
    pendingPaymentCount?: number;
  };
  return {
    subscriptions: payload.subscriptions ?? [],
    pendingPaymentCount: typeof payload.pendingPaymentCount === "number" ? payload.pendingPaymentCount : 0
  };
}

async function fetchAdminSupportTickets() {
  const response = await fetch("/api/admin/support", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load support tickets.");
  const payload = (await response.json()) as {
    tickets?: SupportTicket[];
    agents?: SupportAgent[];
    metrics?: SupportMetrics;
  };
  return {
    tickets: payload.tickets ?? [],
    agents: payload.agents ?? [],
    metrics: payload.metrics ?? { total: 0, open: 0, highPriority: 0, waiting: 0, overdue: 0 }
  };
}

function supportAgentInviteNotice(name: string, invite?: SupportAgentInviteState) {
  if (invite?.status === "failed") {
    return `${name} was added as a support agent, but the invite email failed. Ask them to use Forgot password from the support login.`;
  }

  if (invite?.status === "placeholder" && invite.devInviteUrl) {
    return `${name} was added as a support agent. Local invite link: ${invite.devInviteUrl}`;
  }

  return `${name} invited as a support agent.`;
}

const selectClassName = "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10";
const couponFilterToolbarClassName = "mt-4 flex min-w-0 flex-wrap items-center gap-3";
const couponSearchControlClassName = "relative min-w-0 flex-[1_1_100%] sm:min-w-[240px] sm:flex-[2_1_240px]";
const couponFilterControlClassName = "min-w-0 flex-[1_1_100%] sm:min-w-[150px] sm:flex-[1_1_150px]";
const couponWideFilterControlClassName = "min-w-0 flex-[1_1_100%] sm:min-w-[170px] sm:flex-[1_1_170px]";
const couponSortControlClassName = "min-w-0 flex-[1_1_100%] sm:min-w-[180px] sm:flex-[1_1_180px]";
const couponResetButtonClassName = "w-full shrink-0 sm:w-auto sm:min-w-[116px]";
const defaultSubscriptionCouponFilters: SubscriptionCouponFilters = {
  search: "",
  status: "",
  plan: "",
  discountType: "",
  sort: "created_desc"
};
const defaultBusinessCouponFilters: BusinessCouponFilters = {
  search: "",
  status: "",
  businessId: "",
  availability: "",
  discountType: "",
  sort: "created_desc"
};

export function AdminOverviewPage() {
  const { data, setData, connected, error, loading, refresh } = useAdminLive();
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [serviceAreaTarget, setServiceAreaTarget] = useState<LiveAdminBusiness | null>(null);
  const [whatsappSetupTarget, setWhatsappSetupTarget] = useState<LiveAdminBusiness | null>(null);
  const [kycReviewTarget, setKycReviewTarget] = useState<LiveAdminBusiness | null>(null);
  const [savingServiceArea, setSavingServiceArea] = useState(false);
  const [savingWhatsappSetup, setSavingWhatsappSetup] = useState(false);

  if (loading) return <DashboardPageSkeleton variant="overview" tone="dark" />;

  async function handleBusinessAction(business: LiveAdminBusiness, action: BusinessAction) {
    if (action === "delete") return;

    setData((current) => updateAdminBusiness(current, business.id, action));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(business.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        await refresh();
        setNotice({ tone: "error", message: `Could not update ${business.name}. Data was refreshed.` });
        return;
      }

      await refresh();
    }

    setNotice({ tone: "success", message: businessActionMessage(business.name, action) });
  }

  async function saveBusinessServiceArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceAreaTarget) return;

    const payload = readBusinessServiceAreaPayload(new FormData(event.currentTarget), serviceAreaTarget);
    const validationError = validateBusinessServiceAreaPayload(payload);
    if (validationError) {
      setNotice({ tone: "error", message: validationError });
      return;
    }

    setSavingServiceArea(true);
    setNotice(null);
    setData((current) => updateAdminBusinessServiceArea(current, serviceAreaTarget.id, payload));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(serviceAreaTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "serviceArea", ...payload })
      });

      if (!response.ok) {
        await refresh();
        setSavingServiceArea(false);
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update ${serviceAreaTarget.name}.`) });
        return;
      }

      await refresh();
    }

    setSavingServiceArea(false);
    setNotice({ tone: "success", message: `${serviceAreaTarget.name} service area saved.` });
    setServiceAreaTarget(null);
  }

  async function saveBusinessWhatsappSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappSetupTarget) return;

    const payload = readBusinessWhatsappSetupPayload(new FormData(event.currentTarget), whatsappSetupTarget);
    const validationError = validateBusinessWhatsappSetupPayload(payload, whatsappSetupTarget);
    if (validationError) {
      setNotice({ tone: "error", message: validationError });
      return;
    }

    setSavingWhatsappSetup(true);
    setNotice(null);
    setData((current) => updateAdminBusinessWhatsappSetup(current, whatsappSetupTarget.id, payload));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(whatsappSetupTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "whatsappSetup", ...payload })
      });

      if (!response.ok) {
        await refresh();
        setSavingWhatsappSetup(false);
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update WhatsApp setup for ${whatsappSetupTarget.name}.`) });
        return;
      }

      await refresh();
    }

    setSavingWhatsappSetup(false);
    setNotice({ tone: "success", message: `${whatsappSetupTarget.name} WhatsApp setup saved.` });
    setWhatsappSetupTarget(null);
  }

  return (
    <>
      <PageHeader
        title="Platform Overview"
        body="Super admin view across all registered businesses, platform orders/bookings, revenue, failures, WhatsApp usage, signups, and churn."
        tone="dark"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button
              variant="secondary"
              icon={<ArrowDownToLine className="size-4" />}
              onClick={() => {
                exportBusinesses("vyapaarmate-business-reports", data.businesses);
                setNotice({ tone: "success", message: `${data.businesses.length} business reports exported.` });
              }}
            >
              Export Business Reports
            </Button>
          </div>
        }
      />
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard density="compact" title="Total businesses" value={String(data.metrics.totalBusinesses)} detail="Tenant records" icon={Building2} tone="blue" />
        <MetricCard density="compact" title="Active businesses" value={String(data.metrics.activeBusinesses)} detail="Accepting operations" icon={CheckCircle2} tone="emerald" />
        <MetricCard density="compact" title="Active subscription revenue" value={formatINR(data.metrics.monthlyRecurringRevenue)} detail="Actual paid active subscriptions" icon={TrendingUp} tone="purple" />
        <MetricCard density="compact" title="Orders/bookings today" value={formatCompact(data.metrics.ordersToday)} detail="Across platform" icon={ClipboardList} tone="blue" />
        <MetricCard density="compact" title="Payment failures" value={String(data.metrics.paymentFailures)} detail="Webhook review needed" icon={ShieldAlert} tone="red" />
        <MetricCard density="compact" title="WhatsApp messages sent" value={formatCompact(data.metrics.whatsappMessagesSent)} detail="Template and status logs" icon={MessageCircle} tone="emerald" />
        <MetricCard density="compact" title="New signups" value={String(data.metrics.newSignups7d)} detail="Last 7 days" icon={Users} tone="amber" />
        <MetricCard density="compact" title="Churned businesses" value={String(data.metrics.churnedBusinesses)} detail="Cancelled plans" icon={TrendingDown} tone="red" />
      </div>
      <div className="mt-5 grid min-w-0 max-w-full gap-5 min-[1700px]:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 overflow-hidden bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Registered businesses</h2>
            <Link href="/admin/businesses" className="text-sm font-bold text-ocean">Manage</Link>
          </div>
          <BusinessTable
            businesses={data.businesses}
            compact
            onBusinessAction={handleBusinessAction}
            onEditServiceArea={setServiceAreaTarget}
            onEditWhatsappSetup={setWhatsappSetupTarget}
            onReviewKyc={setKycReviewTarget}
          />
        </Card>
        <GlassPanel className="min-w-0 overflow-hidden !bg-white">
          <Server className="size-8 text-emerald" />
          <h2 className="mt-4 text-xl font-bold text-ink">System health</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["API routes", "Healthy"],
              ["PostgreSQL", "Ready"],
              ["Cashfree webhooks", "Placeholder"],
              ["WhatsApp webhooks", "Placeholder"],
              ["Audit logs", "Active"]
            ].map(([name, status]) => (
              <div key={name} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white/75 p-3">
                <span className="min-w-0 break-words font-semibold text-slate-700">{name}</span>
                <StatusPill status={status === "Healthy" || status === "Ready" || status === "Active" ? "Active" : "Trial"} />
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
      {serviceAreaTarget && (
        <BusinessServiceAreaDialog
          business={serviceAreaTarget}
          saving={savingServiceArea}
          onClose={() => setServiceAreaTarget(null)}
          onSubmit={saveBusinessServiceArea}
        />
      )}
      {whatsappSetupTarget && (
        <BusinessWhatsappSetupDialog
          business={whatsappSetupTarget}
          saving={savingWhatsappSetup}
          onClose={() => setWhatsappSetupTarget(null)}
          onSubmit={saveBusinessWhatsappSetup}
        />
      )}
      {kycReviewTarget && (
        <BusinessKycReviewDialog
          business={kycReviewTarget}
          onClose={() => setKycReviewTarget(null)}
          onApprove={(business) => {
            setKycReviewTarget(null);
            void handleBusinessAction(business, "approve");
          }}
          onReject={(business) => {
            setKycReviewTarget(null);
            void handleBusinessAction(business, "reject");
          }}
        />
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function AdminBusinessesPage() {
  const { data, setData, connected, error, loading, refresh } = useAdminLive();
  const [draftFilters, setDraftFilters] = useState<BusinessFilters>({ search: "", plan: "", status: "" });
  const [filters, setFilters] = useState<BusinessFilters>(draftFilters);
  const [deleteTarget, setDeleteTarget] = useState<LiveAdminBusiness | null>(null);
  const [serviceAreaTarget, setServiceAreaTarget] = useState<LiveAdminBusiness | null>(null);
  const [whatsappSetupTarget, setWhatsappSetupTarget] = useState<LiveAdminBusiness | null>(null);
  const [payoutSetupTarget, setPayoutSetupTarget] = useState<LiveAdminBusiness | null>(null);
  const [kycReviewTarget, setKycReviewTarget] = useState<LiveAdminBusiness | null>(null);
  const [savingServiceArea, setSavingServiceArea] = useState(false);
  const [savingWhatsappSetup, setSavingWhatsappSetup] = useState(false);
  const [savingPayoutSetup, setSavingPayoutSetup] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const visibleBusinesses = sortBusinessesForAdminReview(filterBusinesses(data.businesses, filters));

  if (loading) return <DashboardPageSkeleton variant="table" tone="dark" />;

  async function handleBusinessAction(business: LiveAdminBusiness, action: BusinessAction) {
    if (action === "delete") {
      setDeleteTarget(business);
      return;
    }

    setData((current) => updateAdminBusiness(current, business.id, action));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(business.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        await refresh();
        setNotice({ tone: "error", message: `Could not update ${business.name}. Data was refreshed.` });
        return;
      }

      await refresh();
    }

    setNotice({ tone: "success", message: businessActionMessage(business.name, action) });
  }

  async function deleteBusiness(business: LiveAdminBusiness) {
    setDeleteTarget(null);
    setData((current) => removeAdminBusiness(current, business.id));

    if (data.source !== "database") {
      setNotice({ tone: "success", message: `${business.name} deleted.` });
      return;
    }

    const response = await fetch(`/api/admin/businesses/${encodeURIComponent(business.id)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      await refresh();
      setNotice({ tone: "error", message: `Could not delete ${business.name}. Data was refreshed.` });
      return;
    }

    await refresh();
    setNotice({ tone: "success", message: `${business.name} and tenant data were deleted.` });
  }

  async function saveBusinessServiceArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceAreaTarget) return;

    const payload = readBusinessServiceAreaPayload(new FormData(event.currentTarget), serviceAreaTarget);
    const validationError = validateBusinessServiceAreaPayload(payload);
    if (validationError) {
      setNotice({ tone: "error", message: validationError });
      return;
    }

    setSavingServiceArea(true);
    setNotice(null);
    setData((current) => updateAdminBusinessServiceArea(current, serviceAreaTarget.id, payload));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(serviceAreaTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "serviceArea", ...payload })
      });

      if (!response.ok) {
        await refresh();
        setSavingServiceArea(false);
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update ${serviceAreaTarget.name}.`) });
        return;
      }

      await refresh();
    }

    setSavingServiceArea(false);
    setNotice({ tone: "success", message: `${serviceAreaTarget.name} service area saved.` });
    setServiceAreaTarget(null);
  }

  async function saveBusinessWhatsappSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappSetupTarget) return;

    const payload = readBusinessWhatsappSetupPayload(new FormData(event.currentTarget), whatsappSetupTarget);
    const validationError = validateBusinessWhatsappSetupPayload(payload, whatsappSetupTarget);
    if (validationError) {
      setNotice({ tone: "error", message: validationError });
      return;
    }

    setSavingWhatsappSetup(true);
    setNotice(null);
    setData((current) => updateAdminBusinessWhatsappSetup(current, whatsappSetupTarget.id, payload));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(whatsappSetupTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "whatsappSetup", ...payload })
      });

      if (!response.ok) {
        await refresh();
        setSavingWhatsappSetup(false);
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update WhatsApp setup for ${whatsappSetupTarget.name}.`) });
        return;
      }

      await refresh();
    }

    setSavingWhatsappSetup(false);
    setNotice({ tone: "success", message: `${whatsappSetupTarget.name} WhatsApp setup saved.` });
    setWhatsappSetupTarget(null);
  }

  async function saveBusinessPayoutSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payoutSetupTarget) return;

    const payload = readBusinessPayoutSetupPayload(new FormData(event.currentTarget), payoutSetupTarget);
    const validationError = validateBusinessPayoutSetupPayload(payload);
    if (validationError) {
      setNotice({ tone: "error", message: validationError });
      return;
    }

    setSavingPayoutSetup(true);
    setNotice(null);
    setData((current) => updateAdminBusinessPayoutSetup(current, payoutSetupTarget.id, payload));

    if (data.source === "database") {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(payoutSetupTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payoutSetup", ...payload })
      });

      if (!response.ok) {
        await refresh();
        setSavingPayoutSetup(false);
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update payouts for ${payoutSetupTarget.name}.`) });
        return;
      }

      await refresh();
    }

    setSavingPayoutSetup(false);
    setNotice({ tone: "success", message: `${payoutSetupTarget.name} payout setup saved.` });
    setPayoutSetupTarget(null);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setNotice({ tone: "success", message: `${filterBusinesses(data.businesses, draftFilters).length} businesses match the filters.` });
  }

  return (
    <>
      <PageHeader
        title="Businesses"
        body="Search and filter by business name, phone, city, status, plan, revenue, order/booking count, and verification state."
        tone="dark"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button
              variant="secondary"
              icon={<ArrowDownToLine className="size-4" />}
              onClick={() => {
                exportBusinesses("vyapaarmate-filtered-businesses", visibleBusinesses);
                setNotice({ tone: "success", message: `${visibleBusinesses.length} visible businesses exported.` });
              }}
            >
              Export Reports
            </Button>
          </div>
        }
      />
      <Card className="mb-5 min-w-0 bg-white">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-5 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search by name, phone, city, status"
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.currentTarget.value }))}
            />
          </div>
          <select
            className={selectClassName}
            value={draftFilters.plan}
            onChange={(event) => setDraftFilters((current) => ({ ...current, plan: event.currentTarget.value }))}
          >
            <option value="">All plans</option>
            {pricingPlans.map((plan) => <option key={plan.id} value={plan.name}>{plan.name}</option>)}
          </select>
          <Input
            placeholder="Active status"
            value={draftFilters.status}
            onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.currentTarget.value }))}
          />
          <Button variant="secondary" icon={<SlidersHorizontal className="size-4" />} onClick={applyFilters}>
            Filters
          </Button>
        </div>
      </Card>
      <Card className="min-w-0 overflow-hidden bg-white p-0">
        <BusinessTable
          businesses={visibleBusinesses}
          onBusinessAction={handleBusinessAction}
          onEditServiceArea={setServiceAreaTarget}
          onEditWhatsappSetup={setWhatsappSetupTarget}
          onEditPayoutSetup={setPayoutSetupTarget}
          onReviewKyc={setKycReviewTarget}
        />
      </Card>
      {deleteTarget && (
        <ActionDialog
          title="Delete business"
          body={businessDeleteBody(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteBusiness(deleteTarget)}>
              Delete Business
            </Button>
          </div>
        </ActionDialog>
      )}
      {serviceAreaTarget && (
        <BusinessServiceAreaDialog
          business={serviceAreaTarget}
          saving={savingServiceArea}
          onClose={() => setServiceAreaTarget(null)}
          onSubmit={saveBusinessServiceArea}
        />
      )}
      {whatsappSetupTarget && (
        <BusinessWhatsappSetupDialog
          business={whatsappSetupTarget}
          saving={savingWhatsappSetup}
          onClose={() => setWhatsappSetupTarget(null)}
          onSubmit={saveBusinessWhatsappSetup}
        />
      )}
      {payoutSetupTarget && (
        <BusinessPayoutSetupDialog
          business={payoutSetupTarget}
          saving={savingPayoutSetup}
          onClose={() => setPayoutSetupTarget(null)}
          onSubmit={saveBusinessPayoutSetup}
        />
      )}
      {kycReviewTarget && (
        <BusinessKycReviewDialog
          business={kycReviewTarget}
          onClose={() => setKycReviewTarget(null)}
          onApprove={(business) => {
            setKycReviewTarget(null);
            void handleBusinessAction(business, "approve");
          }}
          onReject={(business) => {
            setKycReviewTarget(null);
            void handleBusinessAction(business, "reject");
          }}
        />
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function AdminOrdersPage() {
  const { data, connected, error, loading } = useAdminLive();

  if (loading) return <DashboardPageSkeleton variant="table" tone="dark" />;

  return (
    <>
      <PageHeader
        title="Platform Orders & Bookings"
        body="View orders, bookings, and service requests across the platform while preserving business-level access boundaries."
        tone="dark"
        action={<LiveSyncStatus connected={connected} source={data.source} error={error} />}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Orders/bookings today" value={formatCompact(data.metrics.ordersToday)} detail="All tenants" icon={ClipboardList} tone="blue" />
        <MetricCard title="Active businesses" value={String(data.metrics.activeBusinesses)} detail="Tenant order sources" icon={CheckCircle2} tone="emerald" />
        <MetricCard title="Payment failures" value={String(data.metrics.paymentFailures)} detail="Needs trend review" icon={ShieldAlert} tone="red" />
        <MetricCard title="Businesses tracked" value={String(data.businesses.length)} detail="Loaded in admin table" icon={Building2} tone="amber" />
      </div>
    </>
  );
}

export function AdminPaymentsPage() {
  const { data, connected, error, loading, refresh } = useAdminLive();
  const [payoutTarget, setPayoutTarget] = useState<LiveAdminBusiness | null>(null);
  const [upiVerificationTarget, setUpiVerificationTarget] = useState<PendingPlatformUpiPayment | null>(null);
  const [pendingUpiPayments, setPendingUpiPayments] = useState<PendingPlatformUpiPayment[]>([]);
  const [pendingUpiPaymentsLoading, setPendingUpiPaymentsLoading] = useState(true);
  const [savingPayout, setSavingPayout] = useState(false);
  const [savingUpiVerification, setSavingUpiVerification] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const providerPending = data.businesses.reduce((sum, business) => sum + business.walletPendingProviderSettlement, 0);
  const processingPayouts = data.businesses.reduce((sum, business) => sum + business.walletProcessingPayouts, 0);
  const paidOut = data.businesses.reduce((sum, business) => sum + business.walletPaidOut, 0);

  const loadPendingUpiPayments = useCallback(() => {
    void fetchPendingPlatformUpiPayments()
      .then(setPendingUpiPayments)
      .catch(() => setNotice({ tone: "error", message: "Could not load pending PSHR UPI payments." }))
      .finally(() => setPendingUpiPaymentsLoading(false));
  }, []);

  useEffect(() => {
    loadPendingUpiPayments();
  }, [loadPendingUpiPayments]);

  useStreamRefresh({
    url: "/api/admin/live",
    eventName: "admin",
    onRefresh: loadPendingUpiPayments
  });

  const pendingUpiPaymentPagination = usePaginatedItems(pendingUpiPayments, {
    resetKey: `${pendingUpiPayments.length}-${pendingUpiPayments[0]?.id ?? "empty"}-${pendingUpiPayments.at(-1)?.id ?? "empty"}`
  });
  const payoutPagination = usePaginatedItems(data.businesses, {
    resetKey: `${data.businesses.length}-${data.businesses[0]?.id ?? "empty"}-${data.businesses.at(-1)?.id ?? "empty"}`
  });

  if (loading) return <DashboardPageSkeleton variant="table" tone="dark" />;

  async function verifyUpiPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!upiVerificationTarget) return;

    const reference = formString(new FormData(event.currentTarget), "reference", "");
    if (reference.length < 4) {
      setNotice({ tone: "error", message: "Enter the bank UTR or a clear verification reference." });
      return;
    }

    setSavingUpiVerification(true);
    setNotice(null);
    const response = await fetch(`/api/admin/payments/${encodeURIComponent(upiVerificationTarget.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", reference })
    });

    if (!response.ok) {
      setSavingUpiVerification(false);
      setNotice({ tone: "error", message: await readAdminActionError(response, `Could not verify ${upiVerificationTarget.orderNumber}.`) });
      return;
    }

    const [payments] = await Promise.all([fetchPendingPlatformUpiPayments(), refresh()]);
    setPendingUpiPayments(payments);
    setSavingUpiVerification(false);
    setUpiVerificationTarget(null);
    setNotice({ tone: "success", message: `${upiVerificationTarget.orderNumber} verified and credited to the business wallet.` });
  }

  async function recordPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payoutTarget) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      method: formString(formData, "method", "BANK_TRANSFER"),
      reference: formString(formData, "reference", ""),
      notes: formString(formData, "notes", "")
    };

    setSavingPayout(true);
    setNotice(null);

    const response = await fetch(`/api/admin/businesses/${encodeURIComponent(payoutTarget.id)}/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setSavingPayout(false);
      setNotice({ tone: "error", message: await readAdminActionError(response, `Could not record payout for ${payoutTarget.name}.`) });
      return;
    }

    const result = (await response.json().catch(() => ({}))) as BusinessPayoutActionResponse;
    const emailNotice = businessPayoutEmailNotice(result.payoutEmail);
    await refresh();
    setSavingPayout(false);
    setNotice({ tone: emailNotice.tone, message: `Payout recorded for ${payoutTarget.name}. ${emailNotice.message}` });
    setPayoutTarget(null);
  }

  return (
    <>
      <PageHeader
        title="Platform Payments"
        body="Platform-collected revenue, settled wallet credits, Cashfree automatic payouts, and payout records."
        tone="dark"
        action={<LiveSyncStatus connected={connected} source={data.source} error={error} />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Revenue processed" value={formatINR(data.businesses.reduce((sum, business) => sum + business.revenue, 0))} detail="Completed payments" icon={CreditCard} tone="emerald" />
        <MetricCard title="Ready for payout" value={formatINR(data.metrics.pendingBusinessPayouts)} detail="Due to saved payout accounts" icon={Wallet} tone="blue" />
        <MetricCard title="9 AM batch pending" value={formatINR(providerPending)} detail="Releases within 24 hours" icon={Activity} tone="purple" />
        <MetricCard title="Processing payout" value={formatINR(processingPayouts)} detail="Cashfree transfers in flight" icon={ArrowLeftRight} tone="amber" />
        <MetricCard title="Paid out" value={formatINR(paidOut)} detail="Confirmed business payouts" icon={CheckCircle2} tone="emerald" />
      </div>
      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line p-5">
          <h2 className="font-bold text-ink">PSHR UPI payments awaiting bank verification</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Verify the exact amount and order reference in the PSHR Innovex bank account before crediting a business wallet.</p>
        </div>
        {pendingUpiPaymentsLoading ? (
          <div className="grid gap-3 p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : pendingUpiPayments.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">No direct UPI payments are waiting for verification.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>{["Order", "Business", "Customer", "Amount", "Created", "Status", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pendingUpiPaymentPagination.pageItems.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-4"><a href={payment.orderUrl} target="_blank" rel="noreferrer" className="font-bold text-ocean">{payment.orderNumber}</a></td>
                    <td className="px-4 py-4 font-semibold text-ink">{payment.businessName}</td>
                    <td className="px-4 py-4 text-slate-600"><p>{payment.customerName}</p><p className="mt-1 text-xs">{maskPhone(payment.customerPhone)}</p></td>
                    <td className="px-4 py-4 font-bold">{formatINR(payment.amount)}</td>
                    <td className="px-4 py-4 text-slate-600">{new Date(payment.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <PaymentStatusAnimation status={payment.status} mode="bankVerification" label={`${payment.status.toLowerCase()} payment`} />
                        <StatusPill status={payment.status} />
                      </div>
                    </td>
                    <td className="px-4 py-4"><Button size="sm" variant="emerald" onClick={() => setUpiVerificationTarget(payment)}>Verify Bank Payment</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls
          page={pendingUpiPaymentPagination.page}
          pageCount={pendingUpiPaymentPagination.pageCount}
          totalItems={pendingUpiPaymentPagination.totalItems}
          startItem={pendingUpiPaymentPagination.startItem}
          endItem={pendingUpiPaymentPagination.endItem}
          itemLabel="UPI payments"
          onPageChange={pendingUpiPaymentPagination.setPage}
        />
      </Card>
      <Card className="mt-5 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-mist text-xs uppercase text-slate-500">
              <tr>{["Business", "Auto payout", "Gross", "Fees", "9 AM batch pending", "Ready", "Processing", "Paid out", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payoutPagination.pageItems.map((business) => (
                <tr key={business.id}>
                  <td className="px-4 py-4">
                    <p className="font-bold text-ink">{business.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{business.city}, {business.state}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-44 items-center gap-2">
                      <PaymentStatusAnimation
                        status={payoutAutomationAnimationStatus(business)}
                        label={payoutAutomationLabel(business)}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-ink">{payoutAutomationLabel(business)}</p>
                        <p className="truncate text-xs text-slate-500">{payoutDestinationLabel(business)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold">{formatINR(business.walletGrossCredited)}</td>
                  <td className="px-4 py-4 text-slate-600">{formatINR(business.walletPlatformFees)}</td>
                  <td className="px-4 py-4 text-slate-600">{formatINR(business.walletPendingProviderSettlement)}</td>
                  <td className="px-4 py-4 font-bold text-ocean">{formatINR(business.walletAvailableForPayout)}</td>
                  <td className="px-4 py-4 font-bold text-amber-700">{formatINR(business.walletProcessingPayouts)}</td>
                  <td className="px-4 py-4 text-slate-600">{formatINR(business.walletPaidOut)}</td>
                  <td className="px-4 py-4">
                    <Button
                      size="sm"
                      variant="emerald"
                      disabled={business.walletAvailableForPayout <= 0}
                      onClick={() => setPayoutTarget(business)}
                    >
                      Record Payout
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={payoutPagination.page}
          pageCount={payoutPagination.pageCount}
          totalItems={payoutPagination.totalItems}
          startItem={payoutPagination.startItem}
          endItem={payoutPagination.endItem}
          itemLabel="business payouts"
          onPageChange={payoutPagination.setPage}
        />
      </Card>
      {payoutTarget && (
        <ActionDialog title="Record payout" body={`${payoutTarget.name} · ${formatINR(payoutTarget.walletAvailableForPayout)}`} onClose={() => setPayoutTarget(null)}>
          <form className="grid gap-4" onSubmit={recordPayout}>
            <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-3 text-sm leading-6 text-slate-700">
              Cashfree automatic payouts send eligible settled balances first. Record this manually only after PSHR Innovex has sent the amount outside Cashfree.
            </div>
            <div className="rounded-xl border border-line bg-mist p-3 text-sm leading-6 text-slate-700">
              <p className="font-bold text-ink">Owner payout destination</p>
              <p className="mt-1">{payoutDestinationLabel(payoutTarget)}</p>
              {payoutTarget.payoutAccountHolderName && (
                <p className="mt-1 text-xs font-semibold text-slate-500">Account holder: {payoutTarget.payoutAccountHolderName}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Method</Label>
              <Input name="method" defaultValue={payoutTarget.payoutMethod === "UPI" ? "UPI" : "BANK_TRANSFER"} />
            </div>
            <div className="grid gap-2">
              <Label>Reference</Label>
              <Input name="reference" placeholder="Bank UTR, payout ID, or note" />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea name="notes" placeholder="Optional settlement note" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setPayoutTarget(null)} disabled={savingPayout}>Cancel</Button>
              <Button type="submit" variant="emerald" disabled={savingPayout}>
                {savingPayout ? "Saving" : "Record Payout"}
              </Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {upiVerificationTarget && (
        <ActionDialog
          title="Verify PSHR UPI payment"
          body={`${upiVerificationTarget.orderNumber} · ${upiVerificationTarget.businessName} · ${formatINR(upiVerificationTarget.amount)}`}
          onClose={() => setUpiVerificationTarget(null)}
        >
          <form className="grid gap-4" onSubmit={verifyUpiPayment}>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
              Do not approve from a screenshot. Confirm the credit in the PSHR Innovex bank account, including exact amount and order reference.
            </div>
            <div className="grid gap-2">
              <Label>Bank UTR / verification reference</Label>
              <Input name="reference" minLength={4} maxLength={120} required placeholder="Enter the bank UTR" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setUpiVerificationTarget(null)} disabled={savingUpiVerification}>Cancel</Button>
              <Button type="submit" variant="emerald" disabled={savingUpiVerification}>{savingUpiVerification ? "Verifying" : "Verify and Credit Wallet"}</Button>
            </div>
          </form>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function AdminSubscriptionsPage() {
  const { data, connected, error, loading, refresh } = useAdminLive();
  const [pendingUpiSubscriptions, setPendingUpiSubscriptions] = useState<PendingSubscriptionUpiPayment[]>([]);
  const [pendingUpiSubscriptionsLoading, setPendingUpiSubscriptionsLoading] = useState(true);
  const [verificationTarget, setVerificationTarget] = useState<PendingSubscriptionUpiPayment | null>(null);
  const [savingVerification, setSavingVerification] = useState(false);
  const [planDetailsOpen, setPlanDetailsOpen] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const planCounts = data.metrics.subscriptionPlanCounts ?? { STARTER: 0, PRO: 0 };
  const activeSubscriptionCount = data.metrics.activeSubscriptions ?? 0;
  const recentSubscriptions = data.subscriptions ?? [];
  const recentSubscriptionPagination = usePaginatedItems(recentSubscriptions, {
    resetKey: `${recentSubscriptions.length}-${recentSubscriptions[0]?.id ?? "empty"}-${recentSubscriptions.at(-1)?.id ?? "empty"}`
  });

  const loadPendingUpiSubscriptions = useCallback(() => {
    void fetchPendingSubscriptionUpiPayments()
      .then((result) => {
        setPendingUpiSubscriptions(result.subscriptions);
      })
      .catch(() => setNotice({ tone: "error", message: "Could not load pending PSHR Innovex subscription payments." }))
      .finally(() => setPendingUpiSubscriptionsLoading(false));
  }, []);

  useEffect(() => {
    loadPendingUpiSubscriptions();
  }, [loadPendingUpiSubscriptions]);

  useStreamRefresh({
    url: "/api/admin/live",
    eventName: "admin",
    onRefresh: loadPendingUpiSubscriptions
  });

  const pendingSubscriptionPagination = usePaginatedItems(pendingUpiSubscriptions, {
    resetKey: `${pendingUpiSubscriptions.length}-${pendingUpiSubscriptions[0]?.id ?? "empty"}-${pendingUpiSubscriptions.at(-1)?.id ?? "empty"}`
  });

  if (loading) return <DashboardPageSkeleton variant="billing" tone="dark" />;

  async function verifySubscriptionPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationTarget) return;

    const reference = formString(new FormData(event.currentTarget), "reference", "");
    if (reference.length < 4) {
      setNotice({ tone: "error", message: "Enter the bank UTR or a clear verification reference." });
      return;
    }

    setSavingVerification(true);
    setNotice(null);
    const response = await fetch(`/api/admin/subscriptions/${encodeURIComponent(verificationTarget.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", reference })
    });

    if (!response.ok) {
      setSavingVerification(false);
      setNotice({ tone: "error", message: await readAdminActionError(response, `Could not verify ${verificationTarget.reference}.`) });
      return;
    }

    const [result] = await Promise.all([fetchPendingSubscriptionUpiPayments(), refresh()]);
    setPendingUpiSubscriptions(result.subscriptions);
    setSavingVerification(false);
    setVerificationTarget(null);
    setNotice({ tone: "success", message: `${verificationTarget.reference} verified. ${verificationTarget.businessName} is now on the ${verificationTarget.plan.toLowerCase()} plan.` });
  }

  return (
    <>
      <PageHeader
        title="Subscriptions"
        body="Monitor Starter and Pro subscriptions, payment status, churn, and setup fees."
        tone="dark"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<FileClock className="size-4" />}
              onClick={() => setPlanDetailsOpen(true)}
            >
              View Plans
            </Button>
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Active subscription revenue" value={formatINR(data.metrics.monthlyRecurringRevenue)} detail="Actual paid active subscriptions" icon={CreditCard} tone="purple" />
        <MetricCard title="Active subscriptions" value={String(activeSubscriptionCount)} detail="Paid tenants" icon={ShieldCheck} tone="emerald" />
        <MetricCard title="Pending payments" value={String(data.metrics.pendingSubscriptionPayments ?? 0)} detail="Incomplete Cashfree/UPI checkouts" icon={FileClock} tone="amber" />
      </div>
      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line p-5">
          <h2 className="font-bold text-ink">Recent subscription payments</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Cashfree and PSHR Innovex UPI subscription checkout history across businesses.</p>
        </div>
        {recentSubscriptions.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">No subscription checkout records found yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>{["Reference", "Business", "Owner", "Plan", "Provider", "Amount", "Payment", "Paid", "Period"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentSubscriptionPagination.pageItems.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="px-4 py-4 font-bold text-ocean">{subscription.reference}</td>
                    <td className="px-4 py-4 font-semibold text-ink">{subscription.businessName}</td>
                    <td className="px-4 py-4 text-slate-600"><p>{subscription.ownerName}</p><p className="mt-1 text-xs">{maskPhone(subscription.ownerPhone)}</p></td>
                    <td className="px-4 py-4"><Badge variant={subscription.plan === "PRO" ? "purple" : "blue"}>{subscription.plan}</Badge></td>
                    <td className="px-4 py-4 text-slate-600">{subscription.paymentProviderLabel}</td>
                    <td className="px-4 py-4 font-bold">{formatINR(subscription.amount)}</td>
                    <td className="px-4 py-4"><StatusPill status={subscription.paymentState} /></td>
                    <td className="px-4 py-4 text-slate-600">
                      {subscription.paidAt ? new Date(subscription.paidAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(subscription.periodStart).toLocaleDateString("en-IN", { dateStyle: "medium" })} - {new Date(subscription.periodEnd).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls
          page={recentSubscriptionPagination.page}
          pageCount={recentSubscriptionPagination.pageCount}
          totalItems={recentSubscriptionPagination.totalItems}
          startItem={recentSubscriptionPagination.startItem}
          endItem={recentSubscriptionPagination.endItem}
          itemLabel="subscription payments"
          onPageChange={recentSubscriptionPagination.setPage}
        />
      </Card>
      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line p-5">
          <h2 className="font-bold text-ink">PSHR Innovex subscription payments awaiting verification</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Activate a plan only after matching the exact amount and payment reference in the company bank account.</p>
        </div>
        {pendingUpiSubscriptionsLoading ? (
          <div className="grid gap-3 p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : pendingUpiSubscriptions.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">No direct UPI subscription payments are waiting for verification.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>{["Reference", "Business", "Owner", "Plan", "Amount", "Created", "State", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pendingSubscriptionPagination.pageItems.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="px-4 py-4 font-bold text-ocean">{subscription.reference}</td>
                    <td className="px-4 py-4 font-semibold text-ink">{subscription.businessName}</td>
                    <td className="px-4 py-4 text-slate-600"><p>{subscription.ownerName}</p><p className="mt-1 text-xs">{maskPhone(subscription.ownerPhone)}</p></td>
                    <td className="px-4 py-4"><Badge variant={subscription.plan === "PRO" ? "purple" : "blue"}>{subscription.plan}</Badge></td>
                    <td className="px-4 py-4 font-bold">{formatINR(subscription.amount)}</td>
                    <td className="px-4 py-4 text-slate-600">{new Date(subscription.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-4 py-4"><StatusPill status={subscription.paymentState} /></td>
                    <td className="px-4 py-4"><Button size="sm" variant="emerald" onClick={() => setVerificationTarget(subscription)}>Verify Payment</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls
          page={pendingSubscriptionPagination.page}
          pageCount={pendingSubscriptionPagination.pageCount}
          totalItems={pendingSubscriptionPagination.totalItems}
          startItem={pendingSubscriptionPagination.startItem}
          endItem={pendingSubscriptionPagination.endItem}
          itemLabel="subscription payments"
          onPageChange={pendingSubscriptionPagination.setPage}
        />
      </Card>
      {verificationTarget && (
        <ActionDialog
          title="Verify subscription payment"
          body={`${verificationTarget.reference} · ${verificationTarget.businessName} · ${formatINR(verificationTarget.amount)}`}
          onClose={() => setVerificationTarget(null)}
        >
          <form className="grid gap-4" onSubmit={verifySubscriptionPayment}>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
              Confirm the payment in the PSHR Innovex bank account. Do not activate a subscription from a screenshot alone.
            </div>
            <div className="grid gap-2">
              <Label>Bank UTR / verification reference</Label>
              <Input name="reference" minLength={4} maxLength={120} required placeholder="Enter the bank UTR" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setVerificationTarget(null)} disabled={savingVerification}>Cancel</Button>
              <Button type="submit" variant="emerald" disabled={savingVerification}>{savingVerification ? "Verifying" : "Verify and Activate"}</Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {planDetailsOpen && (
        <ActionDialog
          title="Subscription plans"
          body="Starter and Pro pricing shown to businesses."
          className="max-w-5xl"
          onClose={() => setPlanDetailsOpen(false)}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex min-h-full flex-col rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <h3 className="break-words text-2xl font-extrabold leading-8 text-ink">{plan.name}</h3>
                  {plan.id === "PRO" && (
                    <Badge variant="purple" className="shrink-0 px-3 py-1.5 text-sm">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="mt-7 text-4xl font-extrabold leading-none text-ink sm:text-5xl">
                  {formatINR(plan.price)}
                </p>
                <p className="mt-4 text-lg text-slate-500">{planCounts[plan.id]} paid businesses</p>
                <p className="mt-7 text-base leading-8 text-slate-600">{plan.description}</p>
                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-base leading-7 text-slate-700">
                      <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald" />
                      <span className="min-w-0 break-words">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function AdminSupportPage({
  canManageAgents = false
}: {
  canManageAgents?: boolean;
}) {
  const searchParams = useSearchParams();
  const requestedTicketId = searchParams.get("ticket");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [metrics, setMetrics] = useState<SupportMetrics>({ total: 0, open: 0, highPriority: 0, waiting: 0, overdue: 0 });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | SupportTicket["status"] | "ALL">("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [savingTicket, setSavingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [agentReplyStatus, setAgentReplyStatus] = useState<AgentReplyStatus>("WAITING_ON_CUSTOMER");
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentActionId, setAgentActionId] = useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [intentDialogOpen, setIntentDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const supportConversationScrollRef = useRef<HTMLDivElement | null>(null);
  const agentReplyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const visibleTickets = tickets.filter((ticket) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") return isActiveSupportStatus(ticket.status);
    return ticket.status === statusFilter;
  });
  const ticketPagination = usePaginatedItems(visibleTickets, {
    resetKey: `${statusFilter}-${visibleTickets.length}-${visibleTickets[0]?.id ?? "empty"}-${visibleTickets.at(-1)?.id ?? "empty"}`
  });
  const messagePagination = usePaginatedItems(selectedTicket?.messages ?? [], {
    resetKey: `${selectedTicket?.id ?? "none"}-${selectedTicket?.messages.length ?? 0}-${selectedTicket?.messages[0]?.id ?? "empty"}-${selectedTicket?.messages.at(-1)?.id ?? "empty"}`,
    resetPage: "last"
  });
  const messageScrollKey = `${selectedTicket?.id ?? "none"}-${messagePagination.page}-${messagePagination.endItem}-${messagePagination.totalItems}`;
  const selectedTicketStatus = selectedTicket?.status;
  const accountSecurityPortal = canManageAgents ? "admin" : "support";
  const accountSecurityTitle = canManageAgents ? "Admin password" : "Support password";
  const accountSecurityBody = `Change the password used for ${canManageAgents ? "platform admin" : "support portal"} sign-in.`;
  const agentMutationBusy = savingAgent || Boolean(agentActionId);
  const agentCreateDisabled = agentMutationBusy || Boolean(editingAgentId);

  const loadTickets = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const payload = await fetchAdminSupportTickets();
      setTickets(payload.tickets);
      setAgents(payload.agents);
      setMetrics(payload.metrics);
    } catch {
      setNotice({ tone: "error", message: "Could not load support tickets." });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useStreamRefresh({
    url: "/api/admin/support",
    eventName: "support",
    onRefresh: () => loadTickets(false)
  });

  useEffect(() => {
    let cancelled = false;
    void fetchAdminSupportTickets()
      .then((payload) => {
        if (cancelled) return;
        setTickets(payload.tickets);
        setAgents(payload.agents);
        setMetrics(payload.metrics);
      })
      .catch(() => {
        if (!cancelled) setNotice({ tone: "error", message: "Could not load support tickets." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const conversation = supportConversationScrollRef.current;
    if (!conversation) return;

    conversation.scrollTop = conversation.scrollHeight;
  }, [messageScrollKey]);

  useEffect(() => {
    if (!requestedTicketId || !tickets.some((ticket) => ticket.id === requestedTicketId)) return;
    const frame = window.requestAnimationFrame(() => setSelectedTicketId(requestedTicketId));
    return () => window.cancelAnimationFrame(frame);
  }, [requestedTicketId, tickets]);

  useEffect(() => {
    if (!selectedTicketStatus) return;

    const frame = window.requestAnimationFrame(() => {
      setAgentReplyStatus(defaultAgentReplyStatus(selectedTicketStatus));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedTicketId, selectedTicketStatus]);

  useEffect(() => {
    if (!selectedTicketId || selectedTicketStatus === "CLOSED") return;

    const frame = window.requestAnimationFrame(() => {
      agentReplyTextareaRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedTicketId, selectedTicketStatus]);

  async function patchTicket(ticket: SupportTicket, payload: Record<string, unknown>, successMessage: string) {
    setSavingTicket(true);
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(ticket.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update ${ticket.code}.`) });
        return;
      }
      await loadTickets();
      setNotice({ tone: "success", message: successMessage });
    } catch {
      setNotice({ tone: "error", message: "Could not reach support ticket service." });
    } finally {
      setSavingTicket(false);
    }
  }

  async function createSupportAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAgents) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = formString(formData, "name", "Support agent");
    const email = formString(formData, "email", "");
    const phone = formString(formData, "phone", "");

    setSavingAgent(true);
    try {
      const response = await fetch("/api/admin/support/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone })
      });
      const payload = (await response.json().catch(() => ({}))) as SupportAgentActionResponse;
      if (!response.ok) {
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : `Could not invite ${name}.` });
        return;
      }

      form.reset();
      await loadTickets();
      setNotice({
        tone: payload.invite?.status === "failed" ? "error" : "success",
        message: supportAgentInviteNotice(name, payload.invite)
      });
    } catch {
      setNotice({ tone: "error", message: "Could not reach support agent service." });
    } finally {
      setSavingAgent(false);
    }
  }

  async function updateSupportAgent(event: FormEvent<HTMLFormElement>, agent: SupportAgent) {
    event.preventDefault();
    if (!canManageAgents || agent.role !== "SUPPORT_AGENT") return;

    const formData = new FormData(event.currentTarget);
    const name = formString(formData, "name", agent.name);
    const email = formString(formData, "email", agent.email);
    const phone = formString(formData, "phone", "");

    setAgentActionId(`edit:${agent.id}`);
    try {
      const response = await fetch(`/api/admin/support/agents/${encodeURIComponent(agent.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone })
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, `Could not update ${agent.name}.`) });
        return;
      }

      await loadTickets();
      setEditingAgentId(null);
      setNotice({ tone: "success", message: `${name} updated.` });
    } catch {
      setNotice({ tone: "error", message: "Could not reach support agent service." });
    } finally {
      setAgentActionId(null);
    }
  }

  async function resendSupportAgentInvite(agent: SupportAgent) {
    if (!canManageAgents || agent.role !== "SUPPORT_AGENT") return;

    setAgentActionId(`resend:${agent.id}`);
    try {
      const response = await fetch(`/api/admin/support/agents/${encodeURIComponent(agent.id)}`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as SupportAgentActionResponse;
      if (!response.ok) {
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : `Could not resend invite to ${agent.name}.` });
        return;
      }

      setNotice({
        tone: "success",
        message: payload.invite?.status === "placeholder" && payload.invite.devInviteUrl
          ? `Invite ready for ${agent.name}. Local invite link: ${payload.invite.devInviteUrl}`
          : `Invite resent to ${agent.name}.`
      });
    } catch {
      setNotice({ tone: "error", message: "Could not reach support agent service." });
    } finally {
      setAgentActionId(null);
    }
  }

  async function deleteSupportAgent(agent: SupportAgent) {
    if (!canManageAgents || agent.role !== "SUPPORT_AGENT") return;
    if (!window.confirm(`Delete support agent ${agent.name}? Assigned tickets will become unassigned.`)) return;

    setAgentActionId(`delete:${agent.id}`);
    try {
      const response = await fetch(`/api/admin/support/agents/${encodeURIComponent(agent.id)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as SupportAgentActionResponse;
      if (!response.ok) {
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : `Could not delete ${agent.name}.` });
        return;
      }

      await loadTickets();
      setNotice({ tone: "success", message: `${agent.name} deleted from support agents.` });
    } catch {
      setNotice({ tone: "error", message: "Could not reach support agent service." });
    } finally {
      setAgentActionId(null);
    }
  }

  async function sendAgentReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = formString(formData, "body", "");
    const status = agentReplyStatus || defaultAgentReplyStatus(selectedTicket.status);
    if (body.length < 2) {
      setNotice({ tone: "error", message: "Enter a reply before sending." });
      return;
    }

    setSendingReply(true);
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(selectedTicket.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, status })
      });
      const payload = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) {
        setNotice({ tone: "error", message: typeof payload.error === "string" ? payload.error : `Could not reply to ${selectedTicket.code}.` });
        return;
      }
      form.reset();
      await loadTickets();
      setNotice({
        tone: "success",
        message: `Reply saved in chat for ${selectedTicket.code}.`
      });
    } catch {
      setNotice({ tone: "error", message: "Could not reach support reply service." });
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Support Portal"
        body="Agent queue for customer and business requests, payment issues, WhatsApp setup, and account access."
        tone="dark"
        action={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {canManageAgents && (
                <button
                  type="button"
                  onClick={() => setAgentDialogOpen(true)}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <UserPlus className="size-4" />
                  Agents
                </button>
              )}
              <button
                type="button"
                onClick={() => setPolicyDialogOpen(true)}
                className="rounded-md px-2 py-1 text-xs font-bold text-emerald underline-offset-4 transition hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-emerald/50"
              >
                Bot security rules
              </button>
              <button
                type="button"
                onClick={() => setIntentDialogOpen(true)}
                className="rounded-md px-2 py-1 text-xs font-bold text-sky-300 underline-offset-4 transition hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-sky-300/50"
              >
                Intent ownership
              </button>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<KeyRound className="size-4" />}
              onClick={() => setPasswordDialogOpen(true)}
              className="h-9 border-white/15 bg-white/10 px-3 text-white shadow-none hover:translate-y-0 hover:border-white/25 hover:bg-white/15"
            >
              {accountSecurityTitle}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Open queue" value={String(metrics.open)} detail={`${metrics.total} total tracked`} icon={MessageCircle} tone="blue" />
        <MetricCard title="Overdue" value={String(metrics.overdue)} detail="Past first-response SLA" icon={ShieldAlert} tone="red" />
        <MetricCard title="High priority" value={String(metrics.highPriority)} detail="Payment, access, or security risk" icon={Activity} tone="amber" />
        <MetricCard title="Bot reply cap" value={`${supportReplyWordLimit} words`} detail="Short responses enforced" icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="mt-5">
        <Card className="bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-ink">Agent Queue</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Customer and business requests are assigned to available agents automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ACTIVE", "OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER", "RESOLVED", "ALL"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-xs font-bold transition",
                    statusFilter === status
                      ? "border-emerald/20 bg-emerald/10 text-emerald"
                      : "border-line bg-white text-slate-600 hover:border-ocean/30"
                  )}
                >
                  {status === "ACTIVE" ? "Active" : status.replaceAll("_", " ")}
                </button>
              ))}
              <Button size="sm" variant="secondary" onClick={() => void loadTickets()} disabled={loading}>Refresh</Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {loading && (
              <div className="grid gap-3">
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
            )}
            {!loading && visibleTickets.length === 0 && (
              <div className="rounded-lg border border-line bg-mist p-5 text-sm leading-6 text-slate-600">
                No support tickets match this filter.
              </div>
            )}
            {!loading && ticketPagination.pageItems.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
                className={cn(
                  "grid gap-3 rounded-lg border bg-mist p-4 text-left transition hover:border-ocean/30 hover:bg-white",
                  ticket.isOverdue ? "border-red-200" : "border-line"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={supportPriorityVariant(ticket.priority)}>{supportPriorityLabel(ticket.priority)}</Badge>
                  <StatusPill status={ticket.status} label={supportStatusLabel(ticket.status)} />
                  <span className="text-xs font-bold uppercase text-slate-500">{ticket.code}</span>
                  <span className={cn("ml-auto text-xs font-semibold", ticket.isOverdue ? "text-red-700" : "text-slate-500")}>{ticket.slaLabel} SLA</span>
                </div>
                <div className="grid gap-1">
                  <h3 className="font-bold text-ink">{ticket.subject}</h3>
                  <p className="text-sm text-slate-600">{ticket.businessName}</p>
                </div>
                <p className="rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-600">{ticket.lastMessage}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>Intent: {ticket.intent}</span>
                  <span>Source: {supportSourceLabel(ticket.source)}</span>
                  <span>Agent: {ticket.assignedToName ?? "Unassigned"}</span>
                  {ticket.feedback && <span>Feedback: {ticket.feedback.rating}/5</span>}
                  <span>Messages: {ticket.messageCount}</span>
                </div>
              </button>
            ))}
            {!loading && (
              <PaginationControls
                className="border-t-0 px-0 pb-0"
                page={ticketPagination.page}
                pageCount={ticketPagination.pageCount}
                totalItems={ticketPagination.totalItems}
                startItem={ticketPagination.startItem}
                endItem={ticketPagination.endItem}
                itemLabel="tickets"
                onPageChange={ticketPagination.setPage}
              />
            )}
          </div>
        </Card>
      </div>

      {policyDialogOpen && (
        <ActionDialog
          title="Bot Security Rules"
          body="Guardrails and escalation triggers used by the support chatbot."
          className="max-w-2xl"
          onClose={() => setPolicyDialogOpen(false)}
        >
          <div className="grid gap-5">
            <div className="rounded-lg bg-ink p-4 text-white">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-emerald">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold">Bot Security Rules</h3>
                  <p className="mt-1 text-sm leading-6 text-white/60">Public chat stays bounded, safe, and ready for human handoff.</p>
                </div>
              </div>
              <ul className="mt-4 grid gap-3">
                {supportBotGuardrails.map((rule) => (
                  <li key={rule} className="flex gap-2 text-sm leading-6 text-white/75">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <h3 className="font-bold text-ink">Escalation Triggers</h3>
              <div className="mt-4 grid gap-3">
                {supportEscalationRules.map((rule) => (
                  <div key={rule} className="rounded-lg border border-line bg-mist p-3 text-sm leading-6 text-slate-700">
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ActionDialog>
      )}

      {passwordDialogOpen && (
        <ActionDialog
          title={accountSecurityTitle}
          body={accountSecurityBody}
          className="max-w-2xl"
          onClose={() => setPasswordDialogOpen(false)}
        >
          <PasswordChangeCard
            portal={accountSecurityPortal}
            title={accountSecurityTitle}
            body={accountSecurityBody}
            surface="plain"
            showHeader={false}
          />
        </ActionDialog>
      )}

      {intentDialogOpen && (
        <ActionDialog
          title="Intent Ownership"
          body="The same routing map powers the chatbot API and this support portal."
          className="max-w-5xl"
          onClose={() => setIntentDialogOpen(false)}
        >
          <div className="grid gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-ocean/15 bg-ocean/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-ink">Shared routing policy</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">Each intent maps a trigger phrase family to an owner and a safe support outcome.</p>
              </div>
              <Badge variant="blue">Shared policy</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {supportChatbotIntents.map((intent) => (
                <div key={intent.id} className="rounded-lg border border-line bg-mist p-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 break-words font-bold text-ink">{intent.label}</h3>
                    <Badge variant="neutral" className="shrink-0 whitespace-normal text-center leading-4">{intent.owner}</Badge>
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase text-slate-500">{intent.trigger}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{intent.outcome}</p>
                </div>
              ))}
            </div>
          </div>
        </ActionDialog>
      )}

      {canManageAgents && agentDialogOpen && (
        <ActionDialog
          title="Support Agents"
          body="Invite support agents and manage assignment access."
          className="max-w-4xl"
          onClose={() => {
            setAgentDialogOpen(false);
            setEditingAgentId(null);
          }}
        >
          <div className="grid gap-5">
            <form className="grid gap-3 rounded-lg border border-line bg-mist p-4" onSubmit={createSupportAgent}>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input name="name" minLength={2} maxLength={80} required disabled={agentCreateDisabled} placeholder="Support agent name" />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" required disabled={agentCreateDisabled} placeholder="agent@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input name="phone" type="tel" disabled={agentCreateDisabled} placeholder="+91..." />
                </div>
                <Button type="submit" variant="emerald" disabled={agentCreateDisabled} icon={<UserPlus className="size-4" />}>
                  {savingAgent ? "Inviting" : "Invite"}
                </Button>
              </div>
            </form>

            <div className="grid gap-3">
              {agents.map((agent) => {
                const supportAgent = agent.role === "SUPPORT_AGENT";
                const editingAgent = editingAgentId === agent.id;
                const editBusy = agentActionId === `edit:${agent.id}`;
                const actionDisabled = agentMutationBusy || Boolean(editingAgentId && !editingAgent);

                if (supportAgent && editingAgent) {
                  return (
                    <form
                      key={agent.id}
                      className="grid gap-4 rounded-lg border border-ocean/30 bg-mist p-4"
                      onSubmit={(event) => void updateSupportAgent(event, agent)}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant="emerald">Support Agent</Badge>
                        <Badge variant={agent.rating.count > 0 ? "amber" : "neutral"} className="gap-1">
                          <Star className={cn("size-3.5", agent.rating.count > 0 ? "fill-amber-500 text-amber-700" : "text-slate-400")} />
                          {supportAgentRatingLabel(agent.rating)}
                        </Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
                        <div className="grid gap-2">
                          <Label>Name</Label>
                          <Input name="name" minLength={2} maxLength={80} required disabled={editBusy} defaultValue={agent.name} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Email</Label>
                          <Input name="email" type="email" required disabled={editBusy} defaultValue={agent.email} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Phone</Label>
                          <Input name="phone" type="tel" disabled={editBusy} defaultValue={agent.phone ?? ""} />
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={editBusy}
                          icon={<CircleX className="size-4" />}
                          onClick={() => setEditingAgentId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          variant="emerald"
                          disabled={editBusy}
                          icon={editBusy ? <Activity className="size-4 animate-spin" /> : <Save className="size-4" />}
                        >
                          {editBusy ? "Saving" : "Save"}
                        </Button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div key={agent.id} className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words font-bold text-ink">{agent.name}</p>
                        <Badge variant={supportAgent ? "emerald" : "blue"}>{supportAgent ? "Support Agent" : "Super Admin"}</Badge>
                        <Badge variant={agent.rating.count > 0 ? "amber" : "neutral"} className="gap-1">
                          <Star className={cn("size-3.5", agent.rating.count > 0 ? "fill-amber-500 text-amber-700" : "text-slate-400")} />
                          {supportAgentRatingLabel(agent.rating)}
                        </Badge>
                      </div>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-600">{agent.email}</p>
                      <p className="text-xs leading-5 text-slate-500">
                        {agent.phone ?? "No phone"} · Added {new Date(agent.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · {supportAgentRatingDetail(agent.rating)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {supportAgent ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionDisabled}
                            icon={<Pencil className="size-4" />}
                            onClick={() => {
                              setNotice(null);
                              setEditingAgentId(agent.id);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionDisabled}
                            icon={<RefreshCw className="size-4" />}
                            onClick={() => void resendSupportAgentInvite(agent)}
                          >
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={actionDisabled}
                            icon={<Trash2 className="size-4" />}
                            onClick={() => void deleteSupportAgent(agent)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <Badge variant="neutral">Assignment only</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {agents.length === 0 && (
                <div className="rounded-lg border border-line bg-mist p-5 text-sm leading-6 text-slate-600">
                  No platform agents loaded.
                </div>
              )}
            </div>
          </div>
        </ActionDialog>
      )}

      {selectedTicket && (
        <ActionDialog
          title={selectedTicket.subject}
          body={`${selectedTicket.code} · ${selectedTicket.businessName}`}
          className="max-w-2xl xl:max-w-3xl"
          onClose={() => setSelectedTicketId(null)}
        >
          <div className="grid gap-3 sm:gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-lg bg-mist p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Priority</p>
                <p className="mt-1 text-sm font-semibold text-ink">{supportPriorityLabel(selectedTicket.priority)}</p>
              </div>
              <div className="rounded-lg bg-mist p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Agent</p>
                <p className="mt-1 break-words text-sm font-semibold text-ink">{selectedTicket.assignedToName ?? "Unassigned"}</p>
              </div>
              <div className="rounded-lg bg-mist p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-ink">{supportStatusLabel(selectedTicket.status)}</p>
              </div>
              <div className="rounded-lg bg-mist p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">SLA</p>
                <p className={cn("mt-1 text-sm font-semibold", selectedTicket.isOverdue ? "text-red-700" : "text-ink")}>{selectedTicket.slaLabel}</p>
              </div>
            </div>
            {selectedTicket.feedback && (
              <div className="rounded-lg border border-emerald/20 bg-emerald/5 p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-emerald">Agent feedback</p>
                <p className="mt-1 text-sm font-semibold text-ink">{selectedTicket.feedback.rating}/5 rating</p>
                {selectedTicket.feedback.comment && <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTicket.feedback.comment}</p>}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="min-w-0 rounded-lg border border-line p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Requester</p>
                <p className="mt-1 break-words text-sm font-semibold text-ink">{selectedTicket.requesterName ?? selectedTicket.requesterBusinessName ?? "Unknown"}</p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">{maskEmail(selectedTicket.requesterEmail)} · {maskPhone(selectedTicket.requesterPhone)}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-line p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">References</p>
                <p className="mt-1 break-words text-sm leading-6 text-slate-600">Order: {selectedTicket.orderReference ?? "Not provided"}</p>
                <p className="break-words text-sm leading-6 text-slate-600">Payment: {selectedTicket.paymentReference ?? "Not provided"}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-line p-2.5 sm:p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Context</p>
                <p className="mt-1 break-words text-sm leading-6 text-slate-600">{supportSourceLabel(selectedTicket.source)} · {selectedTicket.portal}</p>
                <p className="break-words text-sm leading-6 text-slate-600">{selectedTicket.path ?? "No page path"}</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 sm:p-3">
              <p className="text-xs font-bold uppercase text-amber-800">Secure handling</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">{selectedTicket.safeHandlingNote}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="grid gap-2">
                <Label>Assign agent</Label>
                <select
                  className={selectClassName}
                  value={selectedTicket.assignedToUserId ?? ""}
                  disabled={savingTicket || sendingReply}
                  onChange={(event) => void patchTicket(
                    selectedTicket,
                    { assignedToUserId: event.target.value || null },
                    event.target.value ? `${selectedTicket.code} assigned.` : `${selectedTicket.code} unassigned.`
                  )}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{supportAgentOptionLabel(agent)}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <select
                  className={selectClassName}
                  value={selectedTicket.status}
                  disabled={savingTicket || sendingReply}
                  onChange={(event) => {
                    const nextStatus = event.target.value as SupportTicketStatus;
                    setAgentReplyStatus(defaultAgentReplyStatus(nextStatus));
                    void patchTicket(selectedTicket, { status: nextStatus }, `${selectedTicket.code} moved to ${supportStatusLabel(nextStatus)}.`);
                  }}
                >
                  {(["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"] as const).map((status) => (
                    <option key={status} value={status}>{supportStatusLabel(status)}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <select
                  className={selectClassName}
                  value={selectedTicket.priority}
                  disabled={savingTicket || sendingReply}
                  onChange={(event) => void patchTicket(selectedTicket, { priority: event.target.value }, `${selectedTicket.code} priority updated.`)}
                >
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                    <option key={priority} value={priority}>{supportPriorityLabel(priority)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2">
                <p className="text-xs font-bold uppercase text-slate-500">Conversation</p>
              </div>
              <div ref={supportConversationScrollRef} className="max-h-[30svh] min-h-32 overflow-y-auto p-2.5 sm:max-h-64 sm:p-3 xl:max-h-72">
                <div className="grid gap-2.5 sm:gap-3">
                  {messagePagination.pageItems.map((message) => (
                    <div key={message.id} className={cn("grid gap-1 rounded-lg p-2.5 sm:p-3", message.sender === "AGENT" ? "bg-emerald/10" : message.sender === "BOT" ? "bg-blue-50" : "bg-mist")}>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-slate-500">
                        <span>{message.sender}</span>
                        <span>{supportMessageAuthor(message)}</span>
                        <span>{new Date(message.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <PaginationControls
                page={messagePagination.page}
                pageCount={messagePagination.pageCount}
                totalItems={messagePagination.totalItems}
                startItem={messagePagination.startItem}
                endItem={messagePagination.endItem}
                itemLabel="messages"
                onPageChange={messagePagination.setPage}
              />
            </div>
            {selectedTicket.status !== "CLOSED" && (
              <form className="grid gap-3 rounded-lg border border-line p-2.5 sm:p-3" onSubmit={sendAgentReply}>
                <div className="grid gap-2">
                  <Label>Agent reply</Label>
                  <Textarea ref={agentReplyTextareaRef} name="body" minLength={2} maxLength={1200} rows={3} className="min-h-20" placeholder="Write the response to the requester" required />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid gap-2 sm:w-64">
                    <Label>After reply</Label>
                    <select
                      name="status"
                      className={selectClassName}
                      value={agentReplyStatus}
                      disabled={savingTicket || sendingReply}
                      onChange={(event) => setAgentReplyStatus(event.target.value as AgentReplyStatus)}
                    >
                      {agentReplyStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button className="w-full sm:w-auto" variant="secondary" type="button" onClick={() => setSelectedTicketId(null)}>Close</Button>
                    <Button className="w-full sm:w-auto" type="submit" variant="emerald" disabled={savingTicket || sendingReply}>{sendingReply ? "Sending" : "Send Reply"}</Button>
                  </div>
                </div>
              </form>
            )}
            {selectedTicket.status === "CLOSED" && (
              <div className="flex justify-end">
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setSelectedTicketId(null)}>Close</Button>
              </div>
            )}
            </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function isActiveSupportStatus(status: SupportTicket["status"]) {
  return status === "OPEN" || status === "IN_REVIEW" || status === "WAITING_ON_CUSTOMER";
}

const agentReplyStatusOptions: Array<{ value: AgentReplyStatus; label: string }> = [
  { value: "WAITING_ON_CUSTOMER", label: "Waiting on customer" },
  { value: "IN_REVIEW", label: "Keep in review" },
  { value: "RESOLVED", label: "Mark resolved" }
];

function defaultAgentReplyStatus(status: SupportTicketStatus): AgentReplyStatus {
  return status === "RESOLVED" ? "RESOLVED" : "WAITING_ON_CUSTOMER";
}

function supportAgentRatingLabel(rating: SupportAgent["rating"]) {
  if (!rating.count || rating.average === null) return "No rating";
  return `${rating.average.toFixed(1)}/5`;
}

function supportAgentRatingDetail(rating: SupportAgent["rating"]) {
  if (!rating.count || rating.average === null) return "No customer ratings yet";
  return `${rating.count} customer rating${rating.count === 1 ? "" : "s"}`;
}

function supportAgentOptionLabel(agent: SupportAgent) {
  const ratingLabel = supportAgentRatingLabel(agent.rating);
  return ratingLabel === "No rating" ? agent.name : `${agent.name} (${ratingLabel})`;
}

function supportStatusLabel(status: SupportTicket["status"]) {
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_REVIEW":
      return "In Review";
    case "WAITING_ON_CUSTOMER":
      return "Waiting on Customer";
    case "RESOLVED":
      return "Resolved";
    case "CLOSED":
      return "Closed";
  }
}

function supportPriorityLabel(priority: SupportTicket["priority"]) {
  switch (priority) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
  }
}

function supportPriorityVariant(priority: SupportTicket["priority"]): "red" | "amber" | "blue" {
  if (priority === "HIGH") return "red";
  if (priority === "MEDIUM") return "amber";
  return "blue";
}

function supportSourceLabel(source: SupportTicket["source"]) {
  if (source === "CHATBOT") return "Web Chat";
  return source
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function supportMessageAuthor(message: SupportTicketMessage) {
  if (message.authorName) return message.authorName;
  if (message.sender === "BOT") return "VyapaarBot";
  if (message.sender === "CUSTOMER") return "Requester";
  if (message.sender === "SYSTEM") return "System";
  return "Agent";
}

type AdminLogSourceFilter = "all" | LiveAdminLog["source"];

const adminLogSourceFilters: Array<{ value: AdminLogSourceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "audit", label: "Audit" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "payment", label: "Payments" }
];

export function AdminLogsPage() {
  const { data, connected, error, loading, refresh } = useAdminLive();
  const [sourceFilter, setSourceFilter] = useState<AdminLogSourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const auditLogs = data.auditLogs ?? [];
  const whatsappLogs = data.whatsappLogs ?? [];
  const paymentLogs = data.paymentLogs ?? [];
  const allLogs = sortAdminPageLogs([...auditLogs, ...whatsappLogs, ...paymentLogs]);
  const searchText = search.trim().toLowerCase();
  const statusOptions = Array.from(new Set(allLogs.map((log) => log.status))).sort(compareLogStatus);
  const filteredLogs = allLogs.filter((log) => {
    const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSource && matchesStatus && (!searchText || adminLogSearchHaystack(log).includes(searchText));
  });
  const reviewCount = allLogs.filter((log) => log.status === "FAILED" || log.status === "PENDING" || log.status === "QUEUED").length;
  const page = usePaginatedItems(filteredLogs, {
    pageSize: 8,
    resetKey: `${sourceFilter}-${statusFilter}-${searchText}-${allLogs.length}-${allLogs[0]?.id ?? "empty"}`
  });
  const sourceSummaries = [
    {
      source: "audit" as const,
      label: "Audit trail",
      count: auditLogs.length,
      detail: "Admin, system, and tenant-scoped actions"
    },
    {
      source: "whatsapp" as const,
      label: "WhatsApp messages",
      count: whatsappLogs.length,
      detail: "Template sends, provider outcomes, and failures"
    },
    {
      source: "payment" as const,
      label: "Payment events",
      count: paymentLogs.length,
      detail: "Cashfree, PSHR UPI, and subscription payment states"
    }
  ];
  const sourceHealthItems = sourceSummaries.map((summary) => {
    const sourceLogs = allLogs.filter((log) => log.source === summary.source);
    const failedCount = sourceLogs.filter((log) => log.status === "FAILED").length;
    const reviewCount = sourceLogs.filter((log) => log.status === "PENDING" || log.status === "QUEUED").length;
    const status: LiveAdminLog["status"] = failedCount > 0 ? "FAILED" : reviewCount > 0 ? "PENDING" : "COMPLETED";

    return { ...summary, failedCount, reviewCount, status };
  });
  const lastSyncLabel = formatAdminLastSync(data.syncedAt);

  if (loading) return <DashboardPageSkeleton variant="table" tone="dark" />;

  return (
    <>
      <PageHeader
        title="Audit and Message Logs"
        body="Review admin audit events, WhatsApp delivery outcomes, payment provider updates, and tenant-scoped platform actions."
        tone="dark"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        }
      />
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Audit events" value={String(auditLogs.length)} detail="Recent admin and system actions" icon={ClipboardList} tone="blue" />
        <MetricCard title="WhatsApp logs" value={String(whatsappLogs.length)} detail={`${formatCompact(data.metrics.whatsappMessagesSent)} sent overall`} icon={MessageCircle} tone="emerald" />
        <MetricCard title="Payment events" value={String(paymentLogs.length)} detail={`${data.metrics.paymentFailures} failures today`} icon={CreditCard} tone="purple" />
        <MetricCard title="Needs review" value={String(reviewCount)} detail="Failed, pending, or queued events" icon={ShieldAlert} tone={reviewCount > 0 ? "red" : "emerald"} />
      </div>

      <div className="mt-5 grid min-w-0 gap-5">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="min-w-0 bg-white">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-ink">Source health</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Current log source state across audit, WhatsApp, and payment streams.</p>
              </div>
              <Badge variant={reviewCount > 0 ? "amber" : "emerald"}>{reviewCount > 0 ? `${reviewCount} review` : "Healthy"}</Badge>
            </div>
            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {sourceHealthItems.map((summary) => (
                <div key={summary.source} className="min-w-0 rounded-lg border border-line bg-mist/50 p-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-bold leading-6 text-ink">{summary.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{summary.detail}</p>
                    </div>
                    <LogStatusBadge status={summary.status} className="self-start" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="min-w-0 rounded-lg bg-white px-1.5 py-2">
                      <p className="text-lg font-bold text-ink">{summary.count}</p>
                      <p className="text-[9px] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-400 sm:text-[10px]">Events</p>
                    </div>
                    <div className="min-w-0 rounded-lg bg-white px-1.5 py-2">
                      <p className="text-lg font-bold text-red-600">{summary.failedCount}</p>
                      <p className="text-[9px] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-400 sm:text-[10px]">Failed</p>
                    </div>
                    <div className="min-w-0 rounded-lg bg-white px-1.5 py-2">
                      <p className="text-lg font-bold text-amber-700">{summary.reviewCount}</p>
                      <p className="text-[9px] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-400 sm:text-[10px]">Review</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="min-w-0 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-ink">Last sync</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{lastSyncLabel}</p>
              </div>
              <LiveSyncStatus connected={connected} source={data.source} error={error} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 break-words text-slate-500">Loaded businesses</span>
                <span className="shrink-0 font-bold text-ink">{data.businesses.length}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 break-words text-slate-500">Active subscriptions</span>
                <span className="shrink-0 font-bold text-ink">{data.metrics.activeSubscriptions}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 break-words text-slate-500">Today payment failures</span>
                <span className="shrink-0 font-bold text-ink">{data.metrics.paymentFailures}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card className="min-w-0 overflow-hidden p-0">
          <div className="border-b border-line p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-ink">Unified log timeline</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Most recent operational events across audit, messaging, and payments.</p>
              </div>
              <Badge variant="blue">{filteredLogs.length} visible</Badge>
            </div>
            <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
              <label className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search action, business, provider, reference"
                  className="bg-mist/60 pl-10"
                />
              </label>
              <div className="flex min-w-0 flex-wrap gap-2">
                {adminLogSourceFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={sourceFilter === filter.value}
                    onClick={() => setSourceFilter(filter.value)}
                    className={cn(
                      "h-10 rounded-lg border px-3 text-sm font-bold transition",
                      sourceFilter === filter.value
                        ? "border-ocean/30 bg-ocean/10 text-ocean"
                        : "border-line bg-white text-slate-600 hover:border-ocean/20 hover:text-ink"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-white px-3 sm:w-max">
                <SlidersHorizontal className="size-4 shrink-0 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none sm:min-w-36"
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatAdminLogStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-sm leading-6 text-slate-600">No matching log events found for the selected filters.</div>
          ) : (
            <div className="divide-y divide-line" aria-label="Unified log timeline events">
              {page.pageItems.map((log) => (
                <div key={`${log.source}-${log.id}`} className="grid min-w-0 gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_minmax(11rem,15rem)_minmax(8rem,10rem)] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={adminLogSourceVariant(log.source)}>{adminLogSourceLabel(log.source)}</Badge>
                      <p className="min-w-0 break-words text-sm font-bold leading-6 text-ink sm:text-base">{formatAdminLogAction(log.action)}</p>
                    </div>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-600">{log.summary}</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                      <span className="min-w-0 break-words">{log.businessName}</span>
                      {log.actorName && <span className="min-w-0 break-words">{log.actorName}</span>}
                      {log.reference && <span className="min-w-0 break-all">Ref {log.reference}</span>}
                    </div>
                  </div>
                  <p className="min-w-0 break-words text-sm leading-6 text-slate-600 xl:text-right">{log.detail ?? log.entity}</p>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 xl:block">
                    <p className="min-w-0 break-words text-xs font-semibold uppercase leading-5 tracking-[0.1em] text-slate-400">{formatAdminLogDate(log.occurredAt)}</p>
                    <LogStatusBadge status={log.status} className="xl:mt-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <PaginationControls
            page={page.page}
            pageCount={page.pageCount}
            totalItems={page.totalItems}
            startItem={page.startItem}
            endItem={page.endItem}
            itemLabel="log events"
            onPageChange={page.setPage}
          />
        </Card>
      </div>
    </>
  );
}

function couponDateToIso(formData: FormData, key: string, endOfDay = false) {
  const value = formString(formData, key, "");
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+05:30`).toISOString();
}

function couponDateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null;
}

function adminCouponDiscountLabel(coupon: {
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
}) {
  return coupon.discountType === "PERCENTAGE"
    ? `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` up to ${formatINR(coupon.maxDiscountAmount)}` : ""}`
    : formatINR(coupon.discountValue);
}

function adminPlanLabel(plan: "STARTER" | "PRO" | null) {
  if (!plan) return "All plans";
  return plan === "PRO" ? "Pro" : "Starter";
}

function businessCouponAvailability(business: AdminCouponBusiness) {
  return business.isActive && business.isVerified && business.subscriptionStatus === "ACTIVE" && business.kycStatus === "APPROVED";
}

function couponDateValue(value: string | null, fallback = 0) {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallback : timestamp;
}

function compareCouponText(first: string, second: string) {
  return first.localeCompare(second, "en", { sensitivity: "base", numeric: true });
}

function couponSearchText(values: Array<string | number | null | undefined>) {
  return values.map((value) => String(value ?? "")).join(" ").toLowerCase();
}

function sortSubscriptionCoupons(coupons: PlatformSubscriptionCoupon[], sort: SubscriptionCouponSort) {
  return [...coupons].sort((first, second) => {
    const codeTieBreaker = compareCouponText(first.code, second.code);

    switch (sort) {
      case "created_asc":
        return couponDateValue(first.createdAt) - couponDateValue(second.createdAt) || codeTieBreaker;
      case "code_asc":
        return codeTieBreaker || couponDateValue(second.createdAt) - couponDateValue(first.createdAt);
      case "code_desc":
        return compareCouponText(second.code, first.code) || couponDateValue(second.createdAt) - couponDateValue(first.createdAt);
      case "discount_desc":
        return second.discountValue - first.discountValue || codeTieBreaker;
      case "discount_asc":
        return first.discountValue - second.discountValue || codeTieBreaker;
      case "usage_desc":
        return second.redeemedCount - first.redeemedCount || codeTieBreaker;
      case "usage_asc":
        return first.redeemedCount - second.redeemedCount || codeTieBreaker;
      case "expires_asc":
        return couponDateValue(first.expiresAt, Number.MAX_SAFE_INTEGER) - couponDateValue(second.expiresAt, Number.MAX_SAFE_INTEGER) || codeTieBreaker;
      case "created_desc":
      default:
        return couponDateValue(second.createdAt) - couponDateValue(first.createdAt) || codeTieBreaker;
    }
  });
}

function filterSubscriptionCoupons(coupons: PlatformSubscriptionCoupon[], filters: SubscriptionCouponFilters) {
  const search = filters.search.trim().toLowerCase();
  const filteredCoupons = coupons.filter((coupon) => {
    const matchesStatus =
      !filters.status ||
      (filters.status === "ACTIVE" && coupon.isActive) ||
      (filters.status === "INACTIVE" && !coupon.isActive);
    const matchesPlan =
      !filters.plan ||
      (filters.plan === "ALL_PLANS" && coupon.plan === null) ||
      coupon.plan === filters.plan;
    const matchesDiscountType = !filters.discountType || coupon.discountType === filters.discountType;
    const haystack = couponSearchText([
      coupon.code,
      coupon.description,
      adminPlanLabel(coupon.plan),
      coupon.isActive ? "active" : "inactive",
      coupon.discountType === "PERCENTAGE" ? "percentage percent" : "fixed amount",
      adminCouponDiscountLabel(coupon),
      coupon.minimumAmount > 0 ? formatINR(coupon.minimumAmount) : "no minimum",
      coupon.redeemedCount,
      coupon.redemptionLimit ?? "no limit"
    ]);

    return matchesStatus && matchesPlan && matchesDiscountType && (!search || haystack.includes(search));
  });

  return sortSubscriptionCoupons(filteredCoupons, filters.sort);
}

function sortBusinessCoupons(coupons: AdminBusinessCoupon[], sort: BusinessCouponSort) {
  return [...coupons].sort((first, second) => {
    const codeTieBreaker = compareCouponText(first.code, second.code);

    switch (sort) {
      case "created_asc":
        return couponDateValue(first.createdAt) - couponDateValue(second.createdAt) || codeTieBreaker;
      case "code_asc":
        return codeTieBreaker || couponDateValue(second.createdAt) - couponDateValue(first.createdAt);
      case "code_desc":
        return compareCouponText(second.code, first.code) || couponDateValue(second.createdAt) - couponDateValue(first.createdAt);
      case "business_asc":
        return compareCouponText(first.business.name, second.business.name) || codeTieBreaker;
      case "business_desc":
        return compareCouponText(second.business.name, first.business.name) || codeTieBreaker;
      case "discount_desc":
        return second.discountValue - first.discountValue || codeTieBreaker;
      case "discount_asc":
        return first.discountValue - second.discountValue || codeTieBreaker;
      case "usage_desc":
        return second.redeemedCount - first.redeemedCount || codeTieBreaker;
      case "usage_asc":
        return first.redeemedCount - second.redeemedCount || codeTieBreaker;
      case "expires_asc":
        return couponDateValue(first.expiresAt, Number.MAX_SAFE_INTEGER) - couponDateValue(second.expiresAt, Number.MAX_SAFE_INTEGER) || codeTieBreaker;
      case "created_desc":
      default:
        return couponDateValue(second.createdAt) - couponDateValue(first.createdAt) || codeTieBreaker;
    }
  });
}

function filterBusinessCoupons(coupons: AdminBusinessCoupon[], businesses: AdminCouponBusiness[], filters: BusinessCouponFilters) {
  const search = filters.search.trim().toLowerCase();
  const filteredCoupons = coupons.filter((coupon) => {
    const business = businesses.find((candidate) => candidate.id === coupon.businessId);
    const liveForCustomers = business ? businessCouponAvailability(business) : false;
    const matchesStatus =
      !filters.status ||
      (filters.status === "ACTIVE" && coupon.isActive) ||
      (filters.status === "INACTIVE" && !coupon.isActive);
    const matchesAvailability =
      !filters.availability ||
      (filters.availability === "PUBLIC" && liveForCustomers) ||
      (filters.availability === "NOT_LIVE" && !liveForCustomers);
    const matchesBusiness = !filters.businessId || coupon.businessId === filters.businessId;
    const matchesDiscountType = !filters.discountType || coupon.discountType === filters.discountType;
    const haystack = couponSearchText([
      coupon.code,
      coupon.description,
      coupon.business.name,
      coupon.business.ownerName,
      coupon.business.phone,
      coupon.isActive ? "active" : "inactive",
      liveForCustomers ? "public usable live" : "business not live",
      coupon.discountType === "PERCENTAGE" ? "percentage percent" : "fixed amount",
      adminCouponDiscountLabel(coupon),
      coupon.minimumOrderAmount > 0 ? formatINR(coupon.minimumOrderAmount) : "no minimum",
      coupon.redeemedCount,
      coupon.redemptionLimit ?? "no limit"
    ]);

    return matchesStatus && matchesAvailability && matchesBusiness && matchesDiscountType && (!search || haystack.includes(search));
  });

  return sortBusinessCoupons(filteredCoupons, filters.sort);
}

function subscriptionCouponFiltersAreDefault(filters: SubscriptionCouponFilters) {
  return (
    filters.search === "" &&
    filters.status === "" &&
    filters.plan === "" &&
    filters.discountType === "" &&
    filters.sort === defaultSubscriptionCouponFilters.sort
  );
}

function businessCouponFiltersAreDefault(filters: BusinessCouponFilters) {
  return (
    filters.search === "" &&
    filters.status === "" &&
    filters.businessId === "" &&
    filters.availability === "" &&
    filters.discountType === "" &&
    filters.sort === defaultBusinessCouponFilters.sort
  );
}

export function AdminCouponsPage() {
  const [subscriptionCoupons, setSubscriptionCoupons] = useState<PlatformSubscriptionCoupon[]>([]);
  const [businessCoupons, setBusinessCoupons] = useState<AdminBusinessCoupon[]>([]);
  const [businesses, setBusinesses] = useState<AdminCouponBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSubscriptionCoupon, setSavingSubscriptionCoupon] = useState(false);
  const [savingBusinessCoupon, setSavingBusinessCoupon] = useState(false);
  const [subscriptionCouponActionId, setSubscriptionCouponActionId] = useState<string | null>(null);
  const [businessCouponActionId, setBusinessCouponActionId] = useState<string | null>(null);
  const [couponModal, setCouponModal] = useState<"subscription" | "customer" | null>(null);
  const [couponView, setCouponView] = useState<CouponView>("subscription");
  const [subscriptionCouponFilters, setSubscriptionCouponFilters] = useState<SubscriptionCouponFilters>(defaultSubscriptionCouponFilters);
  const [businessCouponFilters, setBusinessCouponFilters] = useState<BusinessCouponFilters>(defaultBusinessCouponFilters);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const activeSubscriptionCoupons = subscriptionCoupons.filter((coupon) => coupon.isActive).length;
  const activeBusinessCoupons = businessCoupons.filter((coupon) => coupon.isActive).length;
  const totalCouponRedemptions =
    subscriptionCoupons.reduce((sum, coupon) => sum + coupon.redeemedCount, 0) +
    businessCoupons.reduce((sum, coupon) => sum + coupon.redeemedCount, 0);

  const refreshCoupons = useCallback(async () => {
    const [subscriptionRows, businessRows] = await Promise.all([
      fetchPlatformSubscriptionCoupons(),
      fetchAdminBusinessCoupons()
    ]);
    setSubscriptionCoupons(subscriptionRows);
    setBusinessCoupons(businessRows.coupons);
    setBusinesses(businessRows.businesses);
  }, []);

  useStreamRefresh({
    url: "/api/admin/live",
    eventName: "admin",
    onRefresh: refreshCoupons
  });

  useEffect(() => {
    let active = true;
    void Promise.all([fetchPlatformSubscriptionCoupons(), fetchAdminBusinessCoupons()])
      .then(([subscriptionRows, businessRows]) => {
        if (!active) return;
        setSubscriptionCoupons(subscriptionRows);
        setBusinessCoupons(businessRows.coupons);
        setBusinesses(businessRows.businesses);
      })
      .catch(() => {
        if (active) setNotice({ tone: "error", message: "Could not load coupon data." });
      })
      .finally(() => {
        if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshCoupons]);

  const visibleSubscriptionCoupons = filterSubscriptionCoupons(subscriptionCoupons, subscriptionCouponFilters);
  const visibleBusinessCoupons = filterBusinessCoupons(businessCoupons, businesses, businessCouponFilters);
  const subscriptionFiltersApplied = !subscriptionCouponFiltersAreDefault(subscriptionCouponFilters);
  const businessFiltersApplied = !businessCouponFiltersAreDefault(businessCouponFilters);
  const subscriptionCouponPagination = usePaginatedItems(visibleSubscriptionCoupons, {
    resetKey: `${JSON.stringify(subscriptionCouponFilters)}-${visibleSubscriptionCoupons.length}-${visibleSubscriptionCoupons[0]?.id ?? "empty"}-${visibleSubscriptionCoupons.at(-1)?.id ?? "empty"}`
  });
  const businessCouponPagination = usePaginatedItems(visibleBusinessCoupons, {
    resetKey: `${JSON.stringify(businessCouponFilters)}-${visibleBusinessCoupons.length}-${visibleBusinessCoupons[0]?.id ?? "empty"}-${visibleBusinessCoupons.at(-1)?.id ?? "empty"}`
  });
  const activeCouponAddLabel = couponView === "subscription" ? "Add subscription coupon" : "Add customer coupon";
  const ActiveCouponAddIcon = couponView === "subscription" ? FileClock : TicketPercent;

  if (loading) return <DashboardPageSkeleton variant="cards" tone="dark" />;

  async function createSubscriptionCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const plan = formString(formData, "plan", "");
    const payload = {
      code: formString(formData, "code", ""),
      description: formString(formData, "description", ""),
      discountType: formString(formData, "discountType", "PERCENTAGE"),
      discountValue: formNumber(formData, "discountValue", 0),
      maxDiscountAmount: formOptionalNumber(formData, "maxDiscountAmount"),
      minimumAmount: formNumber(formData, "minimumAmount", 0),
      plan: plan || null,
      redemptionLimit: formOptionalNumber(formData, "redemptionLimit"),
      startsAt: couponDateToIso(formData, "startsAt"),
      expiresAt: couponDateToIso(formData, "expiresAt", true),
      isActive: true
    };

    setSavingSubscriptionCoupon(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/subscription-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not create subscription coupon.") });
        return;
      }
      form.reset();
      await refreshCoupons();
      setCouponModal(null);
      setNotice({ tone: "success", message: `Subscription coupon ${payload.code.toUpperCase()} created.` });
    } catch {
      setNotice({ tone: "error", message: "Could not create subscription coupon." });
    } finally {
      setSavingSubscriptionCoupon(false);
    }
  }

  async function createBusinessCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      businessId: formString(formData, "businessId", ""),
      code: formString(formData, "code", ""),
      description: formString(formData, "description", ""),
      discountType: formString(formData, "discountType", "PERCENTAGE"),
      discountValue: formNumber(formData, "discountValue", 0),
      maxDiscountAmount: formOptionalNumber(formData, "maxDiscountAmount"),
      minimumOrderAmount: formNumber(formData, "minimumOrderAmount", 0),
      redemptionLimit: formOptionalNumber(formData, "redemptionLimit"),
      startsAt: couponDateToIso(formData, "startsAt"),
      expiresAt: couponDateToIso(formData, "expiresAt", true),
      isActive: true
    };

    setSavingBusinessCoupon(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/business-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not create customer checkout coupon.") });
        return;
      }
      form.reset();
      await refreshCoupons();
      setCouponModal(null);
      setNotice({ tone: "success", message: `Customer checkout coupon ${payload.code.toUpperCase()} created.` });
    } catch {
      setNotice({ tone: "error", message: "Could not create customer checkout coupon." });
    } finally {
      setSavingBusinessCoupon(false);
    }
  }

  async function updateSubscriptionCoupon(couponId: string, payload: Record<string, unknown>, successMessage: string) {
    setSubscriptionCouponActionId(couponId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/subscription-coupons/${encodeURIComponent(couponId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not update subscription coupon.") });
        return;
      }
      await refreshCoupons();
      setNotice({ tone: "success", message: successMessage });
    } catch {
      setNotice({ tone: "error", message: "Could not update subscription coupon." });
    } finally {
      setSubscriptionCouponActionId(null);
    }
  }

  async function updateBusinessCoupon(couponId: string, payload: Record<string, unknown>, successMessage: string) {
    setBusinessCouponActionId(couponId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/business-coupons/${encodeURIComponent(couponId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not update customer checkout coupon.") });
        return;
      }
      await refreshCoupons();
      setNotice({ tone: "success", message: successMessage });
    } catch {
      setNotice({ tone: "error", message: "Could not update customer checkout coupon." });
    } finally {
      setBusinessCouponActionId(null);
    }
  }

  async function deleteSubscriptionCoupon(couponId: string, code: string) {
    setSubscriptionCouponActionId(couponId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/subscription-coupons/${encodeURIComponent(couponId)}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not remove subscription coupon.") });
        return;
      }
      await refreshCoupons();
      setNotice({ tone: "success", message: `Subscription coupon ${code} removed.` });
    } catch {
      setNotice({ tone: "error", message: "Could not remove subscription coupon." });
    } finally {
      setSubscriptionCouponActionId(null);
    }
  }

  async function deleteBusinessCoupon(couponId: string, code: string) {
    setBusinessCouponActionId(couponId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/business-coupons/${encodeURIComponent(couponId)}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not remove customer checkout coupon.") });
        return;
      }
      await refreshCoupons();
      setNotice({ tone: "success", message: `Customer checkout coupon ${code} removed.` });
    } catch {
      setNotice({ tone: "error", message: "Could not remove customer checkout coupon." });
    } finally {
      setBusinessCouponActionId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        body="Create platform subscription coupons and customer checkout coupons assigned to a business."
        tone="dark"
        action={
          <Button type="button" variant="emerald" icon={<ActiveCouponAddIcon className="size-4" />} onClick={() => setCouponModal(couponView)}>
            {activeCouponAddLabel}
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Subscription coupons" value={String(subscriptionCoupons.length)} detail={`${activeSubscriptionCoupons} active for business plan payments`} icon={FileClock} tone="blue" />
        <MetricCard title="Customer coupons" value={String(businessCoupons.length)} detail={`${activeBusinessCoupons} active on public checkout`} icon={TicketPercent} tone="emerald" />
        <MetricCard title="Total redemptions" value={String(totalCouponRedemptions)} detail="Subscription and checkout coupon usage" icon={TrendingUp} tone="purple" />
      </div>

      <div className="coupon-mode-switch mt-5 overflow-hidden rounded-lg border border-line bg-white p-2 shadow-sm">
        <div className="relative grid min-h-20 grid-cols-2 gap-1 overflow-hidden rounded-md bg-slate-950/[0.03] p-1" role="tablist" aria-label="Coupon category">
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1 left-1 w-[calc(50%_-_0.25rem)] rounded-md bg-ink shadow-soft transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              couponView === "customer" && "translate-x-[calc(100%_+_0.5rem)]"
            )}
          />
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-white/80 bg-white text-ocean shadow-sm sm:grid">
            <ArrowLeftRight className="size-4" />
          </span>
          {[
            {
              value: "subscription" as const,
              label: "Subscription",
              caption: "Plan payments",
              count: subscriptionCoupons.length,
              activeCount: activeSubscriptionCoupons,
              icon: FileClock
            },
            {
              value: "customer" as const,
              label: "Customer",
              caption: "Public checkout",
              count: businessCoupons.length,
              activeCount: activeBusinessCoupons,
              icon: TicketPercent
            }
          ].map((option) => {
            const selected = couponView === option.value;
            const OptionIcon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${option.value}-coupon-panel`}
                data-active={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setCouponView(option.value)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  setCouponView(option.value === "subscription" ? "customer" : "subscription");
                }}
                className={cn(
                  "relative z-10 grid min-h-16 min-w-0 content-center rounded-md px-3 py-2 text-left transition duration-300 focus:outline-none focus:ring-4 focus:ring-ocean/10",
                  selected ? "text-white" : "text-slate-600 hover:bg-white/75 hover:text-ink"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "coupon-mode-icon grid size-9 shrink-0 place-items-center rounded-md border transition duration-300",
                      selected ? "border-white/15 bg-white/15 text-white" : "border-line bg-white text-ocean shadow-sm"
                    )}
                  >
                    <OptionIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{option.label}</span>
                    <span className={cn("mt-0.5 block truncate text-xs leading-5", selected ? "text-white/70" : "text-slate-500")}>
                      {option.caption}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1 text-xs font-bold transition duration-300",
                      selected ? "bg-white/15 text-white" : "bg-white text-slate-600 shadow-sm"
                    )}
                  >
                    {option.activeCount}/{option.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-5">
        {couponView === "subscription" && (
        <Card id="subscription-coupon-panel" role="tabpanel" className="coupon-view-panel min-w-0 overflow-hidden bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-ink">
                <FileClock className="size-5 text-ocean" />
                Subscription coupons
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Use these for business plan payments before checkout is sent to Cashfree.</p>
            </div>
            <Badge variant="blue">{activeSubscriptionCoupons} active</Badge>
          </div>
          <div className={couponFilterToolbarClassName}>
            <div className={couponSearchControlClassName}>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search code or description"
                value={subscriptionCouponFilters.search}
                onChange={(event) => setSubscriptionCouponFilters((current) => ({ ...current, search: event.currentTarget.value }))}
              />
            </div>
            <select
              aria-label="Filter subscription coupon status"
              className={cn(selectClassName, couponFilterControlClassName)}
              value={subscriptionCouponFilters.status}
              onChange={(event) => setSubscriptionCouponFilters((current) => ({ ...current, status: event.currentTarget.value as CouponStatusFilter }))}
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              aria-label="Filter subscription coupon plan"
              className={cn(selectClassName, couponFilterControlClassName)}
              value={subscriptionCouponFilters.plan}
              onChange={(event) => setSubscriptionCouponFilters((current) => ({ ...current, plan: event.currentTarget.value as SubscriptionCouponPlanFilter }))}
            >
              <option value="">Any plan</option>
              <option value="ALL_PLANS">All plans only</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
            </select>
            <select
              aria-label="Filter subscription coupon discount type"
              className={cn(selectClassName, couponWideFilterControlClassName)}
              value={subscriptionCouponFilters.discountType}
              onChange={(event) => setSubscriptionCouponFilters((current) => ({ ...current, discountType: event.currentTarget.value as CouponDiscountTypeFilter }))}
            >
              <option value="">Any discount</option>
              <option value="PERCENTAGE">Percent</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
            </select>
            <select
              aria-label="Sort subscription coupons"
              className={cn(selectClassName, couponSortControlClassName)}
              value={subscriptionCouponFilters.sort}
              onChange={(event) => setSubscriptionCouponFilters((current) => ({ ...current, sort: event.currentTarget.value as SubscriptionCouponSort }))}
            >
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="code_asc">Code A-Z</option>
              <option value="code_desc">Code Z-A</option>
              <option value="discount_desc">Discount high-low</option>
              <option value="discount_asc">Discount low-high</option>
              <option value="usage_desc">Usage high-low</option>
              <option value="usage_asc">Usage low-high</option>
              <option value="expires_asc">Expiry soon</option>
            </select>
            <Button type="button" variant="secondary" className={couponResetButtonClassName} icon={<SlidersHorizontal className="size-4" />} disabled={!subscriptionFiltersApplied} onClick={() => setSubscriptionCouponFilters(defaultSubscriptionCouponFilters)}>
              Reset
            </Button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">{visibleSubscriptionCoupons.length} of {subscriptionCoupons.length} shown</p>
          <div className="mt-4 w-full max-w-full overflow-x-scroll overscroll-x-contain rounded-lg border border-line pb-2">
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {["Code", "Status", "Plan", "Discount", "Minimum", "Usage", "Window", "Created", "Actions"].map((heading) => (
                    <th key={heading} className="border-b border-line bg-mist px-3 py-3 text-xs font-bold uppercase text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptionCouponPagination.pageItems.map((coupon) => {
                    const busy = subscriptionCouponActionId === coupon.id;
                    const startsAt = couponDateLabel(coupon.startsAt);
                    const expiresAt = couponDateLabel(coupon.expiresAt);
                    return (
                      <tr key={coupon.id} className="align-top">
                        <td className="border-b border-line px-3 py-3">
                          <p className="font-bold text-ink">{coupon.code}</p>
                          {coupon.description && <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{coupon.description}</p>}
                        </td>
                        <td className="border-b border-line px-3 py-3">
                          <Badge variant={coupon.isActive ? "emerald" : "neutral"}>{coupon.isActive ? "Active" : "Inactive"}</Badge>
                        </td>
                      <td className="border-b border-line px-3 py-3">{adminPlanLabel(coupon.plan)}</td>
                      <td className="border-b border-line px-3 py-3 font-semibold text-ink">{adminCouponDiscountLabel(coupon)}</td>
                      <td className="border-b border-line px-3 py-3">{coupon.minimumAmount > 0 ? formatINR(coupon.minimumAmount) : "No minimum"}</td>
                      <td className="border-b border-line px-3 py-3">{coupon.redeemedCount}{coupon.redemptionLimit ? `/${coupon.redemptionLimit}` : ""} used</td>
                      <td className="border-b border-line px-3 py-3">
                        <p>{startsAt ? `Starts ${startsAt}` : "Starts now"}</p>
                        <p className="mt-1 text-xs text-slate-500">{expiresAt ? `Expires ${expiresAt}` : "No expiry"}</p>
                      </td>
                      <td className="border-b border-line px-3 py-3">{couponDateLabel(coupon.createdAt)}</td>
                      <td className="border-b border-line px-3 py-3">
                        <div className="flex min-w-44 items-center justify-end gap-2">
                          <StatusSwitch
                            checked={coupon.isActive}
                            loading={busy}
                            showLabel={false}
                            aria-label={`Turn subscription coupon ${coupon.code} ${coupon.isActive ? "inactive" : "active"}`}
                            onCheckedChange={(isActive) => updateSubscriptionCoupon(coupon.id, { isActive }, isActive ? `Subscription coupon ${coupon.code} activated.` : `Subscription coupon ${coupon.code} paused.`)}
                          />
                          <Button type="button" size="sm" variant="danger" icon={busy ? <Activity className="size-4 animate-spin" /> : <Trash2 className="size-4" />} disabled={busy} onClick={() => deleteSubscriptionCoupon(coupon.id, coupon.code)}>
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  {visibleSubscriptionCoupons.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                        {subscriptionCoupons.length === 0 ? "No subscription coupons are configured yet." : "No subscription coupons match the current filters."}
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            className="mt-4 rounded-lg border border-line bg-white"
            page={subscriptionCouponPagination.page}
            pageCount={subscriptionCouponPagination.pageCount}
            totalItems={subscriptionCouponPagination.totalItems}
            startItem={subscriptionCouponPagination.startItem}
            endItem={subscriptionCouponPagination.endItem}
            itemLabel="subscription coupons"
            onPageChange={subscriptionCouponPagination.setPage}
          />
        </Card>
        )}

        {couponView === "customer" && (
        <Card id="customer-coupon-panel" role="tabpanel" className="coupon-view-panel min-w-0 overflow-hidden bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h2 className="flex items-center gap-2 font-bold text-ink">
                  <TicketPercent className="size-5 text-emerald" />
                  Customer checkout coupons
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Assign these to a business so customers can apply them on that business checkout.</p>
              </div>
              <Badge variant="emerald">{activeBusinessCoupons} active</Badge>
            </div>
            <div className={couponFilterToolbarClassName}>
              <div className={couponSearchControlClassName}>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search code, business, owner, phone"
                  value={businessCouponFilters.search}
                  onChange={(event) => setBusinessCouponFilters((current) => ({ ...current, search: event.currentTarget.value }))}
                />
              </div>
              <select
                aria-label="Filter customer coupon status"
                className={cn(selectClassName, couponFilterControlClassName)}
                value={businessCouponFilters.status}
                onChange={(event) => setBusinessCouponFilters((current) => ({ ...current, status: event.currentTarget.value as CouponStatusFilter }))}
              >
                <option value="">Any status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                aria-label="Filter customer coupon business"
                className={cn(selectClassName, couponWideFilterControlClassName)}
                value={businessCouponFilters.businessId}
                onChange={(event) => setBusinessCouponFilters((current) => ({ ...current, businessId: event.currentTarget.value }))}
              >
                <option value="">Any business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter customer coupon availability"
                className={cn(selectClassName, couponWideFilterControlClassName)}
                value={businessCouponFilters.availability}
                onChange={(event) => setBusinessCouponFilters((current) => ({ ...current, availability: event.currentTarget.value as BusinessCouponAvailabilityFilter }))}
              >
                <option value="">Any availability</option>
                <option value="PUBLIC">Public usable</option>
                <option value="NOT_LIVE">Business not live</option>
              </select>
              <select
                aria-label="Filter customer coupon discount type"
                className={cn(selectClassName, couponWideFilterControlClassName)}
                value={businessCouponFilters.discountType}
                onChange={(event) => setBusinessCouponFilters((current) => ({ ...current, discountType: event.currentTarget.value as CouponDiscountTypeFilter }))}
              >
                <option value="">Any discount</option>
                <option value="PERCENTAGE">Percent</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
              </select>
              <select
                aria-label="Sort customer coupons"
                className={cn(selectClassName, couponSortControlClassName)}
                value={businessCouponFilters.sort}
                onChange={(event) => setBusinessCouponFilters((current) => ({ ...current, sort: event.currentTarget.value as BusinessCouponSort }))}
              >
                <option value="created_desc">Newest first</option>
                <option value="created_asc">Oldest first</option>
                <option value="business_asc">Business A-Z</option>
                <option value="business_desc">Business Z-A</option>
                <option value="code_asc">Code A-Z</option>
                <option value="code_desc">Code Z-A</option>
                <option value="discount_desc">Discount high-low</option>
                <option value="discount_asc">Discount low-high</option>
                <option value="usage_desc">Usage high-low</option>
                <option value="usage_asc">Usage low-high</option>
                <option value="expires_asc">Expiry soon</option>
              </select>
              <Button type="button" variant="secondary" className={couponResetButtonClassName} icon={<SlidersHorizontal className="size-4" />} disabled={!businessFiltersApplied} onClick={() => setBusinessCouponFilters(defaultBusinessCouponFilters)}>
                Reset
              </Button>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">{visibleBusinessCoupons.length} of {businessCoupons.length} shown</p>
            <div className="mt-4 w-full max-w-full overflow-x-scroll overscroll-x-contain rounded-lg border border-line pb-2">
              <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                  {["Code", "Business", "Status", "Availability", "Discount", "Min order", "Usage", "Window", "Created", "Actions"].map((heading) => (
                    <th key={heading} className="border-b border-line bg-mist px-3 py-3 text-xs font-bold uppercase text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {businessCouponPagination.pageItems.map((coupon) => {
                  const busy = businessCouponActionId === coupon.id;
                  const business = businesses.find((candidate) => candidate.id === coupon.businessId);
                  const liveForCustomers = business ? businessCouponAvailability(business) : false;
                  const startsAt = couponDateLabel(coupon.startsAt);
                  const expiresAt = couponDateLabel(coupon.expiresAt);
                  return (
                    <tr key={coupon.id} className="align-top">
                      <td className="border-b border-line px-3 py-3">
                        <p className="font-bold text-ink">{coupon.code}</p>
                        {coupon.description && <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{coupon.description}</p>}
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <p className="font-semibold text-ink">{coupon.business.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{coupon.business.ownerName} · {maskPhone(coupon.business.phone)}</p>
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <Badge variant={coupon.isActive ? "emerald" : "neutral"}>{coupon.isActive ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <Badge variant={liveForCustomers ? "blue" : "amber"}>{liveForCustomers ? "Public usable" : "Business not live"}</Badge>
                      </td>
                      <td className="border-b border-line px-3 py-3 font-semibold text-ink">{adminCouponDiscountLabel(coupon)}</td>
                      <td className="border-b border-line px-3 py-3">{coupon.minimumOrderAmount > 0 ? formatINR(coupon.minimumOrderAmount) : "No minimum"}</td>
                      <td className="border-b border-line px-3 py-3">{coupon.redeemedCount}{coupon.redemptionLimit ? `/${coupon.redemptionLimit}` : ""} used</td>
                      <td className="border-b border-line px-3 py-3">
                        <p>{startsAt ? `Starts ${startsAt}` : "Starts now"}</p>
                        <p className="mt-1 text-xs text-slate-500">{expiresAt ? `Expires ${expiresAt}` : "No expiry"}</p>
                      </td>
                      <td className="border-b border-line px-3 py-3">{couponDateLabel(coupon.createdAt)}</td>
                      <td className="border-b border-line px-3 py-3">
                        <div className="flex min-w-44 items-center justify-end gap-2">
                          <StatusSwitch
                            checked={coupon.isActive}
                            loading={busy}
                            showLabel={false}
                            aria-label={`Turn customer checkout coupon ${coupon.code} ${coupon.isActive ? "inactive" : "active"}`}
                            onCheckedChange={(isActive) => updateBusinessCoupon(coupon.id, { isActive }, isActive ? `Customer coupon ${coupon.code} activated.` : `Customer coupon ${coupon.code} paused.`)}
                          />
                          <Button type="button" size="sm" variant="danger" icon={busy ? <Activity className="size-4 animate-spin" /> : <Trash2 className="size-4" />} disabled={busy} onClick={() => deleteBusinessCoupon(coupon.id, coupon.code)}>
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  {visibleBusinessCoupons.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-sm text-slate-500">
                        {businessCoupons.length === 0 ? "No customer checkout coupons are configured yet." : "No customer checkout coupons match the current filters."}
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            className="mt-4 rounded-lg border border-line bg-white"
            page={businessCouponPagination.page}
            pageCount={businessCouponPagination.pageCount}
            totalItems={businessCouponPagination.totalItems}
            startItem={businessCouponPagination.startItem}
            endItem={businessCouponPagination.endItem}
            itemLabel="customer coupons"
            onPageChange={businessCouponPagination.setPage}
          />
        </Card>
        )}
      </div>
      {couponModal === "subscription" && (
        <ActionDialog
          title="Add subscription coupon"
          body="Create a platform coupon for business subscription checkout before Cashfree payment."
          onClose={() => setCouponModal(null)}
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createSubscriptionCoupon}>
            <div className="grid gap-1">
              <Label>Code</Label>
              <Input name="code" placeholder="SUBSAVE10" maxLength={32} required />
            </div>
            <div className="grid gap-1">
              <Label>Plan</Label>
              <select name="plan" className={selectClassName}>
                <option value="">All plans</option>
                <option value="STARTER">Starter</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <Label>Description</Label>
              <Input name="description" placeholder="Launch discount" maxLength={160} />
            </div>
            <div className="grid gap-1">
              <Label>Type</Label>
              <select name="discountType" className={selectClassName} defaultValue="PERCENTAGE">
                <option value="PERCENTAGE">Percent</option>
                <option value="FIXED_AMOUNT">Fixed</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Value</Label>
              <Input name="discountValue" type="number" min="1" step="0.01" required />
            </div>
            <div className="grid gap-1">
              <Label>Max discount</Label>
              <Input name="maxDiscountAmount" type="number" min="0" step="0.01" placeholder="Optional" />
            </div>
            <div className="grid gap-1">
              <Label>Minimum amount</Label>
              <Input name="minimumAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
            <div className="grid gap-1">
              <Label>Limit</Label>
              <Input name="redemptionLimit" type="number" min="1" step="1" placeholder="No limit" />
            </div>
            <div className="grid gap-1">
              <Label>Starts</Label>
              <Input name="startsAt" type="date" />
            </div>
            <div className="grid gap-1">
              <Label>Expires</Label>
              <Input name="expiresAt" type="date" />
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setCouponModal(null)}>Cancel</Button>
              <Button type="submit" variant="emerald" disabled={savingSubscriptionCoupon} icon={savingSubscriptionCoupon ? <Activity className="size-4 animate-spin" /> : <FileClock className="size-4" />}>
                {savingSubscriptionCoupon ? "Creating" : "Create subscription coupon"}
              </Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {couponModal === "customer" && (
        <ActionDialog
          title="Add customer coupon"
          body="Create a checkout coupon for one business so customers can apply it on public checkout."
          onClose={() => setCouponModal(null)}
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createBusinessCoupon}>
            <div className="grid gap-1 md:col-span-2">
              <Label>Business</Label>
              <select name="businessId" className={selectClassName} required disabled={businesses.length === 0}>
                <option value="">Select business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name} · {business.ownerName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Code</Label>
              <Input name="code" placeholder="WELCOME10" maxLength={32} required />
            </div>
            <div className="grid gap-1">
              <Label>Type</Label>
              <select name="discountType" className={selectClassName} defaultValue="PERCENTAGE">
                <option value="PERCENTAGE">Percent</option>
                <option value="FIXED_AMOUNT">Fixed</option>
              </select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <Label>Description</Label>
              <Input name="description" placeholder="First order offer" maxLength={160} />
            </div>
            <div className="grid gap-1">
              <Label>Value</Label>
              <Input name="discountValue" type="number" min="1" step="0.01" required />
            </div>
            <div className="grid gap-1">
              <Label>Min order</Label>
              <Input name="minimumOrderAmount" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
            <div className="grid gap-1">
              <Label>Max discount</Label>
              <Input name="maxDiscountAmount" type="number" min="0" step="0.01" placeholder="Optional" />
            </div>
            <div className="grid gap-1">
              <Label>Limit</Label>
              <Input name="redemptionLimit" type="number" min="1" step="1" placeholder="No limit" />
            </div>
            <div className="grid gap-1">
              <Label>Starts</Label>
              <Input name="startsAt" type="date" />
            </div>
            <div className="grid gap-1">
              <Label>Expires</Label>
              <Input name="expiresAt" type="date" />
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setCouponModal(null)}>Cancel</Button>
              <Button type="submit" variant="emerald" disabled={savingBusinessCoupon || businesses.length === 0} icon={savingBusinessCoupon ? <Activity className="size-4 animate-spin" /> : <TicketPercent className="size-4" />}>
                {savingBusinessCoupon ? "Creating" : "Create customer coupon"}
              </Button>
            </div>
          </form>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function AdminSettingsPage() {
  const { data: adminData } = useAdminLive();
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; message: string }[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettingsForm | null>(null);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const paymentSettingsLoadedRef = useRef(false);

  const loadPaymentSettings = useCallback(() => {
    void fetchPlatformPaymentSettings()
      .then((settings) => {
        paymentSettingsLoadedRef.current = true;
        setPaymentSettings(settings);
      })
      .catch(() => setNotice({ tone: "error", message: "Could not load platform payment settings." }));
  }, []);

  useEffect(() => {
    loadPaymentSettings();
  }, [loadPaymentSettings]);

  useEffect(() => {
    if (paymentSettingsLoadedRef.current) loadPaymentSettings();
  }, [adminData.syncedAt, loadPaymentSettings]);

  const announcementPagination = usePaginatedItems(announcements, {
    resetKey: `${announcements.length}-${announcements[0]?.id ?? "empty"}-${announcements.at(-1)?.id ?? "empty"}`
  });

  async function savePaymentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      directUpiEnabled: formChecked(formData, "directUpiEnabled"),
      upiId: formString(formData, "upiId", ""),
      upiName: formString(formData, "upiName", "PSHR INNOVEX PRIVATE LIMITED")
    };

    setSavingPaymentSettings(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readAdminActionError(response, "Could not save platform payment settings.") });
        return;
      }

      const settings = (await response.json()) as PlatformPaymentSettingsForm;
      setPaymentSettings(settings);
      setNotice({
        tone: "success",
        message: settings.activeProvider === "UPI"
          ? "PSHR Innovex direct UPI collection is active. Payments require super admin bank verification."
          : "Cashfree automatic collection is active for customer orders."
      });
    } catch {
      setNotice({ tone: "error", message: "Could not reach the payment settings service." });
    } finally {
      setSavingPaymentSettings(false);
    }
  }

  function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const announcement = {
      id: `announcement_${Date.now()}`,
      title: formString(formData, "title", "Platform announcement"),
      message: formString(formData, "message", "")
    };

    setAnnouncements((current) => [announcement, ...current]);
    setNotice({ tone: "success", message: `${announcement.title} published.` });
  }

  return (
    <>
      <PageHeader title="Admin Settings" body="Manage the PSHR Innovex payment receiver, platform announcements, and security controls." tone="dark" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="bg-white lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">PSHR Innovex payment receiver</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Customer order payments use the configured platform gateway. The saved UPI receiver is only for manual fallback and direct UPI subscription requests.</p>
            </div>
            {paymentSettings && <Badge variant={paymentSettings.activeProvider === "UPI" ? "amber" : "emerald"}>{paymentSettings.activeProvider === "UPI" ? "Direct UPI active" : "Cashfree active"}</Badge>}
          </div>
          {paymentSettings ? (
            <form key={`${paymentSettings.updatedAt}-${paymentSettings.activeProvider}`} className="mt-5 grid gap-4" onSubmit={savePaymentSettings}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>PSHR Innovex UPI ID</Label>
                  <Input name="upiId" defaultValue={paymentSettings.upiId ?? ""} placeholder="pshrinnovex@bank" autoComplete="off" />
                </div>
                <div className="grid gap-2">
                  <Label>Receiver name shown in UPI apps</Label>
                  <Input name="upiName" defaultValue={paymentSettings.upiName} maxLength={80} required />
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-mist p-4">
                <span>
                  <span className="block text-sm font-bold text-ink">Allow direct PSHR UPI QR fallback</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">Customer order payments still use Cashfree with signed automatic confirmation.</span>
                </span>
                <input name="directUpiEnabled" type="checkbox" defaultChecked={paymentSettings.directUpiEnabled} className="size-5" />
              </label>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Direct UPI QR payments do not provide this app a signed gateway webhook. Manual fallback rows are verified in Platform Payments; subscription payments are verified in Subscriptions. Nothing is credited or activated until a super admin confirms the exact bank credit and UTR.
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="emerald" disabled={savingPaymentSettings}>{savingPaymentSettings ? "Saving" : "Save Payment Receiver"}</Button>
              </div>
            </form>
          ) : (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
              <Skeleton className="h-20 rounded-xl" />
              <SkeletonText lines={2} />
              <div className="flex justify-end">
                <Skeleton className="h-10 w-44 rounded-lg" />
              </div>
            </div>
          )}
        </Card>
        <Card className="bg-white">
          <h2 className="font-bold text-ink">Platform announcement</h2>
          <form className="mt-4 grid gap-3" onSubmit={publishAnnouncement}>
            <Label>Title</Label>
            <Input name="title" defaultValue="WhatsApp controls updated" />
            <Label>Message</Label>
            <Textarea name="message" defaultValue="New campaign controls are available. Marketing messages should only be sent to opted-in customers." />
            <Button type="submit" variant="emerald" icon={<Megaphone className="size-4" />}>Publish Announcement</Button>
          </form>
          {announcements.length > 0 && (
            <div className="mt-5 grid gap-3">
              {announcementPagination.pageItems.map((announcement) => (
                <div key={announcement.id} className="rounded-lg bg-mist p-3">
                  <p className="font-semibold text-ink">{announcement.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{announcement.message}</p>
                </div>
              ))}
              <PaginationControls
                className="border-t-0 px-0 pb-0"
                page={announcementPagination.page}
                pageCount={announcementPagination.pageCount}
                totalItems={announcementPagination.totalItems}
                startItem={announcementPagination.startItem}
                endItem={announcementPagination.endItem}
                itemLabel="announcements"
                onPageChange={announcementPagination.setPage}
              />
            </div>
          )}
        </Card>
        <Card className="bg-white">
          <h2 className="font-bold text-ink">Security checklist</h2>
          <div className="mt-4 grid gap-3">
            {[
              "Super admin role required for /admin",
              "JWT secret configured",
              "Webhook signatures verified",
              "Audit logs enabled",
              "Provider secrets encrypted",
              "No hardcoded API keys"
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg bg-mist p-3">
                <ShieldCheck className="size-5 text-emerald" />
                <span className="text-sm font-semibold text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </Card>
        <PasswordChangeCard
          portal="admin"
          title="Admin password"
          body="Change the password used for platform admin sign-in."
        />
      </div>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function BusinessTable({
  businesses,
  compact = false,
  onBusinessAction,
  onEditServiceArea,
  onEditWhatsappSetup,
  onEditPayoutSetup,
  onReviewKyc
}: {
  businesses: LiveAdminBusiness[];
  compact?: boolean;
  onBusinessAction?: (business: LiveAdminBusiness, action: BusinessAction) => void;
  onEditServiceArea?: (business: LiveAdminBusiness) => void;
  onEditWhatsappSetup?: (business: LiveAdminBusiness) => void;
  onEditPayoutSetup?: (business: LiveAdminBusiness) => void;
  onReviewKyc?: (business: LiveAdminBusiness) => void;
}) {
  const sortedBusinesses = sortBusinessesForAdminReview(businesses);
  const tableBusinesses = compact ? sortedBusinesses.slice(0, 3) : sortedBusinesses;
  const pagination = usePaginatedItems(tableBusinesses, {
    resetKey: `${tableBusinesses.length}-${tableBusinesses[0]?.id ?? "empty"}-${tableBusinesses.at(-1)?.id ?? "empty"}`
  });
  const visibleBusinesses = compact ? tableBusinesses : pagination.pageItems;
  const tableHeadings = compact
    ? ["Business", "Phone", "Plan", "Account", "WhatsApp", "Payouts", "Status", "Modes", "Revenue", "Orders", "KYC", "Actions"]
    : ["Business", "Phone", "City", "Plan", "Account", "WhatsApp", "Payouts", "Status", "Modes", "Radius", "Revenue", "Orders", "KYC", "Actions"];
  const cellClassName = "min-w-0 overflow-hidden px-3 py-4 align-middle";
  const mutedCellClassName = cn(cellClassName, "truncate text-slate-600");

  return (
    <>
      <div className="w-full max-w-full overflow-x-auto">
        <table className={compact ? "w-full min-w-[1586px] table-fixed text-left text-sm" : "w-full min-w-[1908px] table-fixed text-left text-sm"}>
        <colgroup>
          {compact ? (
            <>
              <col className="w-[220px]" />
              <col className="w-[128px]" />
              <col className="w-[92px]" />
              <col className="w-[150px]" />
              <col className="w-[116px]" />
              <col className="w-[150px]" />
              <col className="w-[92px]" />
              <col className="w-[96px]" />
              <col className="w-[96px]" />
              <col className="w-[76px]" />
              <col className="w-[150px]" />
              <col className="w-[220px]" />
            </>
          ) : (
            <>
              <col className="w-[240px]" />
              <col className="w-[132px]" />
              <col className="w-[126px]" />
              <col className="w-[92px]" />
              <col className="w-[150px]" />
              <col className="w-[116px]" />
              <col className="w-[150px]" />
              <col className="w-[92px]" />
              <col className="w-[140px]" />
              <col className="w-[96px]" />
              <col className="w-[104px]" />
              <col className="w-[84px]" />
              <col className="w-[150px]" />
              <col className="w-[236px]" />
            </>
          )}
        </colgroup>
        <thead className="bg-mist text-xs uppercase text-slate-500">
          <tr>
            {tableHeadings.map((head) => (
              <th key={head} className={cn("px-3 py-3 font-bold", head === "Actions" && "text-center")}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {visibleBusinesses.map((business) => {
            const BusinessIcon = getBusinessConsoleIcons(business.businessType).businessIcon;
            const approved = isBusinessApproved(business);

            return (
            <tr key={business.id}>
              <td className={cellClassName}>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ocean/10 text-ocean">
                    <BusinessIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{business.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{business.businessType}</p>
                  </div>
                </div>
              </td>
              <td className={mutedCellClassName}>{maskPhone(business.phone)}</td>
              {!compact && <td className={mutedCellClassName}>{business.city}</td>}
              <td className={cellClassName}><Badge variant={business.plan === "Pro" ? "blue" : "neutral"}>{business.plan}</Badge></td>
              <td className={cellClassName}><StatusPill status={business.status} /></td>
              <td className={cellClassName}><WhatsappStatusBadge business={business} /></td>
              <td className={cellClassName}><PayoutDestinationBadge business={business} /></td>
              <td className={cellClassName}><Badge variant={business.isOpen ? "emerald" : "red"}>{business.isOpen ? "Open" : "Closed"}</Badge></td>
              <td className={cn(cellClassName, "text-slate-600")}><FulfillmentModesCell business={business} compact={compact} /></td>
              {!compact && <td className={mutedCellClassName}>{business.serviceRadiusKm > 0 ? `${business.serviceRadiusKm.toFixed(1)} km` : "-"}</td>}
              <td className={cn(cellClassName, "truncate font-bold")}>{formatINR(business.revenue)}</td>
              <td className={cellClassName}>{business.orders}</td>
              <td className={cellClassName}>
                <div className="grid gap-1">
                  <StatusPill status={business.kyc} />
                  <span className="text-xs font-semibold text-slate-500">
                    {business.kycUploadedDocumentCount}/{business.kycRequiredDocumentCount} docs
                  </span>
                </div>
              </td>
              <td className={cn(cellClassName, "text-center")}>
                <div className="flex min-w-0 items-center justify-center gap-1.5">
                  <BusinessApprovalActions
                    business={business}
                    approved={approved}
                    onBusinessAction={onBusinessAction}
                  />
                  <BusinessActionsMenu
                    business={business}
                    approved={approved}
                    compact={compact}
                    onBusinessAction={onBusinessAction}
                    onEditServiceArea={onEditServiceArea}
                    onEditWhatsappSetup={onEditWhatsappSetup}
                    onEditPayoutSetup={onEditPayoutSetup}
                    onReviewKyc={onReviewKyc}
                  />
                </div>
              </td>
            </tr>
            );
          })}
          {visibleBusinesses.length === 0 && (
            <tr>
              <td colSpan={tableHeadings.length} className="px-4 py-6 text-center text-sm text-slate-500">
                No businesses match the current filters.
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
      {!compact && (
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          totalItems={pagination.totalItems}
          startItem={pagination.startItem}
          endItem={pagination.endItem}
          itemLabel="businesses"
          onPageChange={pagination.setPage}
        />
      )}
    </>
  );
}

type BusinessActionsMenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  tone?: "normal" | "danger";
  disabled?: boolean;
  title?: string;
  onSelect: () => void;
};

function BusinessApprovalActions({
  business,
  approved,
  onBusinessAction
}: {
  business: LiveAdminBusiness;
  approved: boolean;
  onBusinessAction?: (business: LiveAdminBusiness, action: BusinessAction) => void;
}) {
  const approvalDisabled = approved || business.kycStatus === "REJECTED" || !business.kycReadyForApproval;
  const rejectDisabled = approved || business.kycStatus === "REJECTED" || business.subscriptionStatus !== "ACTIVE" || business.kycMissingDocumentCount > 0;
  const approvalTitle = approved
    ? `${business.name} is already approved`
    : business.kycStatus === "REJECTED"
      ? "Wait for corrected KYC documents before approving"
    : business.subscriptionStatus !== "ACTIVE"
      ? "Verify subscription payment first"
      : business.kycMissingDocumentCount > 0
        ? "All required KYC documents must be uploaded first"
        : undefined;
  const rejectTitle = approved
    ? `${business.name} is already approved`
    : business.kycStatus === "REJECTED"
      ? "This KYC review is already rejected"
    : business.subscriptionStatus !== "ACTIVE"
      ? "Reject after the subscription is active"
      : business.kycMissingDocumentCount > 0
        ? "Reject after uploaded KYC documents are ready for review"
        : "Reject KYC and ask for corrected documents";

  if (approved) {
    return (
      <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald/20 bg-emerald/10 px-2.5 text-xs font-extrabold text-emerald">
        <CheckCircle2 className="size-4" />
        Approved
      </span>
    );
  }

  if (business.kycStatus === "REJECTED") {
    return (
      <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-extrabold text-red-700">
        <ShieldAlert className="size-4" />
        Rejected
      </span>
    );
  }

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5">
      <button
        type="button"
        title={approvalTitle ?? `Approve ${business.name}`}
        disabled={approvalDisabled}
        onClick={() => onBusinessAction?.(business, "approve")}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald/25 bg-emerald px-2.5 text-xs font-extrabold text-white shadow-[0_12px_28px_rgba(17,166,106,0.18)] transition hover:-translate-y-0.5 hover:bg-emerald/90 disabled:translate-y-0 disabled:border-line disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
      >
        <CheckCircle2 className="size-4" />
        Approve
      </button>
      <button
        type="button"
        title={rejectTitle}
        disabled={rejectDisabled}
        onClick={() => onBusinessAction?.(business, "reject")}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-extrabold text-red-700 shadow-[0_10px_24px_rgba(220,38,38,0.08)] transition hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 disabled:translate-y-0 disabled:border-line disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
      >
        <ShieldAlert className="size-4" />
        Reject
      </button>
    </div>
  );
}

function BusinessActionsMenu({
  business,
  approved,
  compact,
  onBusinessAction,
  onEditServiceArea,
  onEditWhatsappSetup,
  onEditPayoutSetup,
  onReviewKyc
}: {
  business: LiveAdminBusiness;
  approved: boolean;
  compact: boolean;
  onBusinessAction?: (business: LiveAdminBusiness, action: BusinessAction) => void;
  onEditServiceArea?: (business: LiveAdminBusiness) => void;
  onEditWhatsappSetup?: (business: LiveAdminBusiness) => void;
  onEditPayoutSetup?: (business: LiveAdminBusiness) => void;
  onReviewKyc?: (business: LiveAdminBusiness) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const buttonRect = button.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 248;
    const menuHeight = menuRef.current?.offsetHeight ?? 360;
    const padding = 12;
    const gap = 8;

    const maxLeft = Math.max(padding, window.innerWidth - menuWidth - padding);
    const left = Math.min(
      maxLeft,
      Math.max(padding, buttonRect.right - menuWidth)
    );
    const preferredTop = buttonRect.bottom + gap;
    const top = preferredTop + menuHeight > window.innerHeight - padding
      ? Math.max(padding, buttonRect.top - menuHeight - gap)
      : preferredTop;

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  const whatsappApprovalDisabled = !business.whatsappConnected || !approved;
  const whatsappApprovalTitle = !business.whatsappConnected
    ? "Save WhatsApp setup first"
    : !approved
      ? "Approve the business first"
      : undefined;
  const approvalDisabled = !approved && (business.kycStatus === "REJECTED" || !business.kycReadyForApproval);
  const approvalTitle = approved
    ? undefined
    : business.kycStatus === "REJECTED"
      ? "Wait for corrected KYC documents before approving"
    : business.subscriptionStatus !== "ACTIVE"
      ? "Verify subscription payment first"
      : business.kycMissingDocumentCount > 0
        ? "All required KYC documents must be uploaded first"
        : undefined;
  const rejectionDisabled = approved || business.kycStatus === "REJECTED" || !business.kycReadyForApproval;
  const rejectionTitle = approved
    ? "This business is already approved"
    : business.kycStatus === "REJECTED"
      ? "This KYC review is already rejected"
    : business.subscriptionStatus !== "ACTIVE"
      ? "Verify subscription payment first"
      : business.kycMissingDocumentCount > 0
        ? "All required KYC documents must be uploaded first"
        : undefined;

  const items: BusinessActionsMenuItem[] = [
    {
      key: "approve",
      label: approved ? "Unapprove business" : "Approve business",
      icon: <ShieldCheck className="size-4" />,
      disabled: approvalDisabled,
      title: approvalTitle,
      onSelect: () => onBusinessAction?.(business, approved ? "unapprove" : "approve")
    },
    {
      key: "reject",
      label: "Reject KYC",
      icon: <ShieldAlert className="size-4" />,
      tone: "danger",
      disabled: rejectionDisabled,
      title: rejectionTitle,
      onSelect: () => onBusinessAction?.(business, "reject")
    },
    {
      key: "kyc-review",
      label: "Review KYC docs",
      icon: <FileCheck2 className="size-4" />,
      disabled: !onReviewKyc,
      onSelect: () => onReviewKyc?.(business)
    },
    {
      key: "suspend",
      label: "Suspend business",
      icon: <ShieldAlert className="size-4" />,
      tone: "danger",
      onSelect: () => onBusinessAction?.(business, "suspend")
    },
    {
      key: "open",
      label: business.isOpen ? "Close now" : "Open now",
      icon: <Power className="size-4" />,
      onSelect: () => onBusinessAction?.(business, business.isOpen ? "close" : "open")
    },
    {
      key: "service-area",
      label: "Service area",
      icon: <Settings2 className="size-4" />,
      onSelect: () => onEditServiceArea?.(business)
    },
    {
      key: "whatsapp-setup",
      label: "WhatsApp setup",
      icon: <MessageCircle className="size-4" />,
      onSelect: () => onEditWhatsappSetup?.(business)
    },
    {
      key: "whatsapp-approval",
      label: business.whatsappLiveEnabled ? "Disable WhatsApp" : "Approve WhatsApp",
      icon: <MessageCircle className="size-4" />,
      disabled: whatsappApprovalDisabled,
      title: whatsappApprovalTitle,
      onSelect: () => onBusinessAction?.(business, business.whatsappLiveEnabled ? "disableWhatsapp" : "approveWhatsapp")
    },
    ...(onEditPayoutSetup ? [{
      key: "payout-setup",
      label: "Payout setup",
      icon: <CreditCard className="size-4" />,
      onSelect: () => onEditPayoutSetup(business)
    }] : []),
    ...(!compact ? [{
      key: "delete",
      label: "Delete business",
      icon: <Trash2 className="size-4" />,
      tone: "danger" as const,
      onSelect: () => onBusinessAction?.(business, "delete")
    }] : [])
  ];

  function toggleMenu() {
    if (!open) updatePosition();
    setOpen((current) => !current);
  }

  function selectItem(item: BusinessActionsMenuItem) {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Manage ${business.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Manage ${business.name}`}
        className="inline-grid size-9 place-items-center rounded-lg border border-line bg-white text-slate-600 transition hover:border-ocean/30 hover:bg-mist hover:text-ink focus:outline-none focus:ring-4 focus:ring-ocean/10"
        onClick={toggleMenu}
      >
        <EllipsisVertical className="size-5" />
      </button>

      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Manage ${business.name}`}
          className="fixed z-[1000] max-h-[calc(100vh-1.5rem)] w-[248px] overflow-x-hidden overflow-y-auto rounded-lg border border-line bg-white py-1.5 text-left shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
          style={{ top: position.top, left: position.left }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
                item.tone === "danger"
                  ? "text-red-700 hover:bg-red-50"
                  : "text-ink hover:bg-mist"
              )}
              onClick={() => selectItem(item)}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md",
                  item.tone === "danger" ? "bg-red-50 text-red-600" : "bg-ocean/10 text-ocean"
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function BusinessServiceAreaDialog({
  business,
  saving,
  onClose,
  onSubmit
}: {
  business: LiveAdminBusiness;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const icons = getBusinessConsoleIcons(business.businessType);
  const BusinessIcon = icons.businessIcon;
  const copy = getBusinessConsoleCopy(business.businessType);
  const fulfillmentProfile = getBusinessFulfillmentProfile(business.businessType);
  const selectedModes = fulfillmentModesForBusiness(business);
  const selectedModeSet = new Set(selectedModes.length ? selectedModes : fulfillmentProfile.defaultModes);

  return (
    <ActionDialog title="Service area" body={business.name} onClose={onClose}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue" className="gap-1.5">
            <BusinessIcon className="size-3.5" />
            {business.businessType}
          </Badge>
          <Badge variant={business.isOpen ? "emerald" : "red"}>{business.isOpen ? "Open now" : "Closed"}</Badge>
        </div>

        <div className="grid gap-3 rounded-lg border border-line bg-mist p-3">
          <Label>Fulfillment modes</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {fulfillmentProfile.allowedModes.map((mode: ActiveFulfillmentMode) => {
              const ModeIcon = fulfillmentModeIcons[mode];

              return (
                <label key={mode} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    name={fulfillmentModeFlagNames[mode]}
                    type="checkbox"
                    defaultChecked={selectedModeSet.has(mode)}
                  />
                  <ModeIcon className="size-4 text-ocean" />
                  {fulfillmentLabelForBusinessType(business.businessType, mode)}
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Business location</Label>
          <BusinessLocationMapPicker
            key={`${business.id}-${business.latitude ?? "none"}-${business.longitude ?? "none"}`}
            defaultLatitude={business.latitude}
            defaultLongitude={business.longitude}
            address={business.address}
            city={business.city}
            state={business.state}
            businessName={business.name}
            mapClassName="h-72"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Service radius in km</Label>
            <Input name="serviceRadiusKm" type="number" min="0" max="500" step="0.1" defaultValue={business.serviceRadiusKm} />
          </div>
          <div className="grid gap-2">
            <Label>{copy.serviceFeeLabel}</Label>
            <Input name="serviceVisitFee" type="number" min="0" step="0.01" defaultValue={business.serviceVisitFee} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="emerald" disabled={saving}>
            {saving ? "Saving" : "Save Service Area"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

function BusinessWhatsappSetupDialog({
  business,
  saving,
  onClose,
  onSubmit
}: {
  business: LiveAdminBusiness;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ActionDialog title="WhatsApp setup" body={business.name} onClose={onClose}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-center gap-2">
          <WhatsappStatusBadge business={business} />
          {business.whatsappAccessTokenConfigured && <Badge variant="blue">Token saved</Badge>}
        </div>

        <div className="grid gap-2">
          <Label>WhatsApp display number</Label>
          <Input name="whatsappDisplayPhone" defaultValue={business.whatsappDisplayPhone ?? business.phone} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Meta phone number ID</Label>
            <Input name="whatsappPhoneNumberId" defaultValue={business.whatsappPhoneNumberId ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label>WABA ID</Label>
            <Input name="whatsappWabaId" defaultValue={business.whatsappWabaId ?? ""} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Permanent access token</Label>
          <Input
            name="whatsappAccessToken"
            type="password"
            placeholder={business.whatsappAccessTokenConfigured ? "Leave blank to keep saved token" : ""}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="emerald" disabled={saving}>
            {saving ? "Saving" : "Save WhatsApp Setup"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

function BusinessPayoutSetupDialog({
  business,
  saving,
  onClose,
  onSubmit
}: {
  business: LiveAdminBusiness;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ActionDialog title="Wallet payout setup" body={business.name} onClose={onClose}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-center gap-2">
          <PayoutSetupStatusBadge business={business} />
          {business.platformFeeBps > 0 && <Badge variant="neutral">{(business.platformFeeBps / 100).toFixed(2)}% platform fee</Badge>}
        </div>

        <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-3 text-sm leading-6 text-slate-700">
          Customer online payments settle to the PSHR Innovex gateway account. Paid orders credit this business wallet, become payout-ready in the next 9 AM IST batch within 24 hours, then admin records the transfer to the saved payout destination.
        </div>

        <div className="grid gap-2">
          <Label>Platform fee in basis points</Label>
          <Input name="platformFeeBps" type="number" min="0" max="5000" step="1" defaultValue={business.platformFeeBps} />
          <p className="text-xs text-slate-500">100 basis points = 1%. The fee is retained before the wallet amount becomes payable.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="emerald" disabled={saving}>
            {saving ? "Saving" : "Save Payout Setup"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

function BusinessKycReviewDialog({
  business,
  onClose,
  onApprove,
  onReject
}: {
  business: LiveAdminBusiness;
  onClose: () => void;
  onApprove: (business: LiveAdminBusiness) => void;
  onReject: (business: LiveAdminBusiness) => void;
}) {
  const approvalBlockedReason =
    business.kycStatus === "REJECTED"
      ? "Corrected KYC documents are required before another admin decision."
      : business.subscriptionStatus !== "ACTIVE"
      ? "Subscription payment is not active."
      : business.kycMissingDocumentCount > 0
        ? `${business.kycMissingDocumentCount} required KYC document${business.kycMissingDocumentCount === 1 ? "" : "s"} missing.`
        : "";

  return (
    <ActionDialog title="KYC review" body={business.name} onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={business.kyc} />
          <Badge variant={business.subscriptionStatus === "ACTIVE" ? "emerald" : "amber"}>
            Subscription {business.subscriptionStatus.replaceAll("_", " ")}
          </Badge>
          <Badge variant="blue">{business.kycUploadedDocumentCount}/{business.kycRequiredDocumentCount} docs</Badge>
        </div>

        {approvalBlockedReason && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">
            {approvalBlockedReason}
          </p>
        )}

        {business.kycRejectionReason && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-800">
            {business.kycRejectionReason}
          </p>
        )}

        <div className="grid gap-3">
          {business.kycDocuments.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-mist p-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{document.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {document.fileName} · {(document.fileSize / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              {document.downloadUrl && (
                <a
                  href={document.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-ink transition hover:bg-black hover:text-white"
                >
                  Open <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          ))}
          {business.kycDocuments.length === 0 && (
            <p className="rounded-lg bg-mist p-3 text-sm text-slate-600">No KYC documents uploaded yet.</p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant="danger"
            icon={<ShieldAlert className="size-4" />}
            disabled={Boolean(approvalBlockedReason)}
            onClick={() => onReject(business)}
          >
            Reject KYC
          </Button>
          <Button
            variant="emerald"
            icon={<ShieldCheck className="size-4" />}
            disabled={!business.kycReadyForApproval}
            onClick={() => onApprove(business)}
          >
            Approve KYC
          </Button>
        </div>
      </div>
    </ActionDialog>
  );
}

function readBusinessServiceAreaPayload(formData: FormData, business: LiveAdminBusiness): BusinessServiceAreaPayload {
  return {
    latitude: formOptionalNumber(formData, "latitude"),
    longitude: formOptionalNumber(formData, "longitude"),
    serviceRadiusKm: formNumber(formData, "serviceRadiusKm", business.serviceRadiusKm),
    serviceVisitFee: formNumber(formData, "serviceVisitFee", business.serviceVisitFee),
    ...filterFulfillmentFlagsForBusinessType(business.businessType, {
      acceptsPickup: formChecked(formData, "acceptsPickup"),
      acceptsDineIn: formChecked(formData, "acceptsDineIn"),
      acceptsServiceAtLocation: formChecked(formData, "acceptsServiceAtLocation")
    })
  };
}

function readBusinessWhatsappSetupPayload(formData: FormData, business: LiveAdminBusiness): BusinessWhatsappSetupPayload {
  return {
    whatsappDisplayPhone: formString(formData, "whatsappDisplayPhone", business.whatsappDisplayPhone ?? business.phone),
    whatsappPhoneNumberId: formString(formData, "whatsappPhoneNumberId", business.whatsappPhoneNumberId ?? ""),
    whatsappWabaId: formString(formData, "whatsappWabaId", business.whatsappWabaId ?? ""),
    whatsappAccessToken: formString(formData, "whatsappAccessToken", "")
  };
}

function readBusinessPayoutSetupPayload(formData: FormData, business: LiveAdminBusiness): BusinessPayoutSetupPayload {
  return {
    platformFeeBps: formNumber(formData, "platformFeeBps", business.platformFeeBps)
  };
}

function validateBusinessWhatsappSetupPayload(payload: BusinessWhatsappSetupPayload, business: LiveAdminBusiness) {
  if (!payload.whatsappDisplayPhone.trim()) return "WhatsApp display number is required.";
  if (!payload.whatsappPhoneNumberId.trim()) return "Meta phone number ID is required.";
  if (!business.whatsappAccessTokenConfigured && !payload.whatsappAccessToken.trim()) {
    return "Permanent access token is required the first time.";
  }
  return null;
}

function validateBusinessPayoutSetupPayload(payload: BusinessPayoutSetupPayload) {
  if (!Number.isInteger(payload.platformFeeBps) || payload.platformFeeBps < 0 || payload.platformFeeBps > 5000) {
    return "Platform fee must be between 0 and 5000 basis points.";
  }
  return null;
}

function validateBusinessServiceAreaPayload(serviceArea: BusinessServiceAreaPayload) {
  if (!serviceArea.acceptsPickup && !serviceArea.acceptsDineIn && !serviceArea.acceptsServiceAtLocation) {
    return "Enable at least one fulfillment option.";
  }

  if (serviceArea.acceptsServiceAtLocation) {
    if (serviceArea.latitude === undefined || serviceArea.longitude === undefined) {
      return "Set the business location pin before enabling service at customer location.";
    }

    if (serviceArea.serviceRadiusKm <= 0) {
      return "Service radius must be greater than 0 km.";
    }
  }

  return null;
}

function updateAdminBusinessWhatsappSetup(
  payload: LiveAdminPayload,
  businessId: string,
  whatsapp: BusinessWhatsappSetupPayload
): LiveAdminPayload {
  const businesses = payload.businesses.map((business) => {
    if (business.id !== businessId) return business;

    const tokenConfigured = business.whatsappAccessTokenConfigured || Boolean(whatsapp.whatsappAccessToken.trim());
    const connected = Boolean(whatsapp.whatsappDisplayPhone && whatsapp.whatsappPhoneNumberId && tokenConfigured);

    return {
      ...business,
      whatsappDisplayPhone: whatsapp.whatsappDisplayPhone,
      whatsappPhoneNumberId: whatsapp.whatsappPhoneNumberId || null,
      whatsappWabaId: whatsapp.whatsappWabaId || null,
      whatsappAccessTokenConfigured: tokenConfigured,
      whatsappConnected: connected,
      whatsappLiveEnabled: false,
      whatsappApprovedAt: null
    };
  });

  return {
    ...payload,
    syncedAt: new Date().toISOString(),
    businesses
  };
}

function updateAdminBusinessServiceArea(
  payload: LiveAdminPayload,
  businessId: string,
  serviceArea: BusinessServiceAreaPayload
): LiveAdminPayload {
  const businesses = payload.businesses.map((business) => {
    if (business.id !== businessId) return business;

    const fulfillmentFlags = filterFulfillmentFlagsForBusinessType(business.businessType, serviceArea);

    return {
      ...business,
      latitude: serviceArea.latitude ?? null,
      longitude: serviceArea.longitude ?? null,
      serviceRadiusKm: serviceArea.serviceRadiusKm,
      serviceVisitFee: serviceArea.serviceVisitFee,
      acceptsPickup: fulfillmentFlags.acceptsPickup,
      acceptsDineIn: fulfillmentFlags.acceptsDineIn,
      acceptsServiceAtLocation: fulfillmentFlags.acceptsServiceAtLocation,
      fulfillmentModes: fulfillmentModesFromFlags({
        businessType: business.businessType,
        acceptsPickup: fulfillmentFlags.acceptsPickup,
        acceptsDineIn: fulfillmentFlags.acceptsDineIn,
        acceptsServiceAtLocation: fulfillmentFlags.acceptsServiceAtLocation
      })
    };
  });

  return {
    ...payload,
    syncedAt: new Date().toISOString(),
    businesses
  };
}

function updateAdminBusinessPayoutSetup(
  payload: LiveAdminPayload,
  businessId: string,
  setup: BusinessPayoutSetupPayload
): LiveAdminPayload {
  const businesses = payload.businesses.map((business) => {
    if (business.id !== businessId) return business;

    return {
      ...business,
      cashfreeVendorId: null,
      cashfreeSplitEnabled: false,
      platformFeeBps: setup.platformFeeBps
    };
  });

  return {
    ...payload,
    syncedAt: new Date().toISOString(),
    businesses
  };
}

function fulfillmentModesSummary(business: LiveAdminBusiness) {
  const modes = fulfillmentModesForBusiness(business);

  return modes.length ? modes.map((mode) => fulfillmentLabelForBusinessType(business.businessType, mode)).join(" / ") : "-";
}

function fulfillmentModesForBusiness(business: LiveAdminBusiness) {
  return business.fulfillmentModes.length
    ? business.fulfillmentModes
    : fulfillmentModesFromFlags({
        businessType: business.businessType,
        acceptsPickup: business.acceptsPickup,
        acceptsDineIn: business.acceptsDineIn,
        acceptsServiceAtLocation: business.acceptsServiceAtLocation
      });
}

function FulfillmentModesCell({ business, compact = false }: { business: LiveAdminBusiness; compact?: boolean }) {
  const modes = fulfillmentModesForBusiness(business);

  if (modes.length === 0) return <span>-</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {modes.map((mode) => {
        const ModeIcon = fulfillmentModeIcons[mode];
        const label = fulfillmentLabelForBusinessType(business.businessType, mode);

        return (
          <span
            key={mode}
            title={label}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-mist px-2 text-xs font-semibold text-slate-700"
          >
            <ModeIcon className="size-3.5 text-ocean" />
            {!compact && label}
          </span>
        );
      })}
    </div>
  );
}

function WhatsappStatusBadge({ business }: { business: LiveAdminBusiness }) {
  if (business.whatsappLiveEnabled) return <Badge variant="emerald">Enabled</Badge>;
  if (business.whatsappConnected) return <Badge variant="amber">Pending</Badge>;
  return <Badge variant="neutral">Not set</Badge>;
}

function PayoutSetupStatusBadge({ business }: { business: LiveAdminBusiness }) {
  if (business.platformFeeBps > 0) return <Badge variant="emerald">Wallet fee set</Badge>;
  return <Badge variant="neutral">Platform wallet</Badge>;
}

function maskedAccountNumber(value: string | null) {
  if (!value) return "";
  const suffix = value.slice(-4);
  return suffix ? `**** ${suffix}` : "";
}

function payoutDestinationLabel(business: LiveAdminBusiness) {
  if (business.payoutMethod === "UPI") return business.payoutUpiId ? `UPI ${business.payoutUpiId}` : "UPI not set";
  const account = maskedAccountNumber(business.payoutBankAccountNumber);
  return [business.payoutBankName, account, business.payoutBankIfsc].filter(Boolean).join(" · ") || "Bank not set";
}

function payoutAutomationAnimationStatus(business: LiveAdminBusiness) {
  if (business.walletProcessingPayouts > 0) return "PROCESSING_PAYOUT";
  if (business.walletAvailableForPayout > 0 || business.walletPendingProviderSettlement > 0) return "PENDING";
  return business.walletPaidOut > 0 ? "COMPLETED" : "PENDING";
}

function payoutAutomationLabel(business: LiveAdminBusiness) {
  if (business.walletProcessingPayouts > 0) return "Cashfree processing";
  if (business.walletAvailableForPayout > 0) return "Ready for auto payout";
  if (business.walletPendingProviderSettlement > 0) return "Awaiting settlement";
  if (business.walletPaidOut > 0) return "Paid out";
  return "No payout due";
}

function PayoutDestinationBadge({ business }: { business: LiveAdminBusiness }) {
  const configured = business.payoutMethod === "UPI"
    ? Boolean(business.payoutUpiId)
    : Boolean(business.payoutBankName && business.payoutBankAccountNumber && business.payoutBankIfsc);

  return (
    <span className="inline-flex max-w-full flex-col gap-1">
      <Badge variant={configured ? "emerald" : "amber"}>{business.payoutMethod === "UPI" ? "UPI" : "Bank"}</Badge>
      <span className="truncate text-xs font-semibold text-slate-500">{payoutDestinationLabel(business)}</span>
    </span>
  );
}

function businessDeleteBody(business: LiveAdminBusiness) {
  const copy = getBusinessConsoleCopy(business.businessType);

  return `${business.name}, its users, ${copy.catalogNavLabel.toLowerCase()}, ${copy.customerPlural.toLowerCase()}, ${copy.transactionPlural.toLowerCase()}, payments, messages, subscriptions, and tenant audit logs will be permanently removed.`;
}

function filterBusinesses(businesses: LiveAdminBusiness[], filters: BusinessFilters) {
  const search = filters.search.trim().toLowerCase();
  const plan = filters.plan.trim().toLowerCase();
  const status = filters.status.trim().toLowerCase();

  return businesses.filter((business) => {
    const haystack = [
      business.name,
      business.phone,
      business.address,
      business.city,
      business.state,
      business.businessType,
      business.status,
      business.whatsappDisplayPhone ?? "",
      business.whatsappPhoneNumberId ?? "",
      business.whatsappLiveEnabled ? "whatsapp live" : business.whatsappConnected ? "whatsapp pending" : "whatsapp not configured",
      "platform wallet payouts",
      business.payoutMethod,
      business.payoutUpiId ?? "",
      business.payoutUpiName ?? "",
      business.payoutAccountHolderName ?? "",
      business.payoutBankName ?? "",
      business.payoutBankAccountNumber ?? "",
      business.payoutBankIfsc ?? "",
      String(business.walletAvailableForPayout),
      String(business.walletProcessingPayouts),
      String(business.walletPendingProviderSettlement),
      String(business.walletPaidOut),
      `${business.kycUploadedDocumentCount}/${business.kycRequiredDocumentCount} kyc docs`,
      business.kycReadyForApproval ? "kyc ready for approval" : "kyc blocked",
      business.isOpen ? "open" : "closed",
      fulfillmentModesSummary(business),
      String(business.latitude ?? ""),
      String(business.longitude ?? ""),
      String(business.serviceRadiusKm),
      business.plan,
      business.kyc
    ].join(" ").toLowerCase();

    return (
      (!search || haystack.includes(search)) &&
      (!plan || business.plan.toLowerCase().includes(plan)) &&
      (!status || business.status.toLowerCase().includes(status))
    );
  });
}

function sortBusinessesForAdminReview(businesses: LiveAdminBusiness[]) {
  return [...businesses].sort((first, second) => {
    const reviewRankDelta = businessReviewRank(first) - businessReviewRank(second);
    if (reviewRankDelta !== 0) return reviewRankDelta;
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

function businessReviewRank(business: LiveAdminBusiness) {
  if (business.kycStatus === "REJECTED") return 3;
  if (!isBusinessApproved(business) && business.kycReadyForApproval) return 0;
  if (!isBusinessApproved(business) && business.kycStatus === "UNDER_REVIEW") return 1;
  if (!isBusinessApproved(business) && (business.status.toLowerCase().includes("pending") || business.kycStatus === "DOCUMENTS_PENDING")) return 2;
  if (isBusinessApproved(business)) return 4;
  return 5;
}

function updateAdminBusiness(payload: LiveAdminPayload, businessId: string, action: BusinessAction): LiveAdminPayload {
  if (action === "delete") return removeAdminBusiness(payload, businessId);

  const businesses = payload.businesses.map((business) => {
    if (business.id !== businessId) return business;

    if (action === "approve") {
      return {
        ...business,
        status: "Active",
        kyc: "Verified",
        kycStatus: "APPROVED" as const,
        kycReadyForApproval: false,
        kycReviewedAt: new Date().toISOString(),
        isOpen: true
      };
    }
    if (action === "reject") {
      return {
        ...business,
        status: "KYC Rejected",
        kyc: "KYC Rejected",
        kycStatus: "REJECTED" as const,
        kycReadyForApproval: false,
        kycReviewedAt: new Date().toISOString(),
        kycRejectionReason: "Rejected by PSHR admin review. Upload corrected KYC documents for another review.",
        isOpen: false,
        whatsappLiveEnabled: false,
        whatsappApprovedAt: null,
        cashfreeSplitEnabled: false
      };
    }
    if (action === "unapprove") {
      return {
        ...business,
        status: business.subscriptionStatus === "ACTIVE" ? "Pending Approval" : "Payment Pending",
        kyc: business.subscriptionStatus === "ACTIVE" && business.kycMissingDocumentCount === 0 ? "Under Review" : business.kyc,
        kycStatus: business.subscriptionStatus === "ACTIVE" && business.kycMissingDocumentCount === 0 ? "UNDER_REVIEW" as const : business.kycStatus,
        kycReadyForApproval: business.subscriptionStatus === "ACTIVE" && business.kycMissingDocumentCount === 0,
        isOpen: false,
        whatsappLiveEnabled: false,
        whatsappApprovedAt: null,
        cashfreeSplitEnabled: false
      };
    }
    if (action === "suspend") {
      return { ...business, status: "Suspended", whatsappLiveEnabled: false, whatsappApprovedAt: null, cashfreeSplitEnabled: false };
    }
    if (action === "open") return { ...business, isOpen: true };
    if (action === "approveWhatsapp") {
      return { ...business, whatsappLiveEnabled: true, whatsappApprovedAt: new Date().toISOString() };
    }
    if (action === "disableWhatsapp") {
      return { ...business, whatsappLiveEnabled: false, whatsappApprovedAt: null };
    }
    return { ...business, isOpen: false };
  });

  return {
    ...payload,
    syncedAt: new Date().toISOString(),
    metrics: {
      ...payload.metrics,
      activeBusinesses: businesses.filter((business) => business.status.toLowerCase() === "active").length
    },
    businesses
  };
}

function removeAdminBusiness(payload: LiveAdminPayload, businessId: string): LiveAdminPayload {
  const business = payload.businesses.find((candidate) => candidate.id === businessId);
  const businesses = payload.businesses.filter((candidate) => candidate.id !== businessId);

  return {
    ...payload,
    syncedAt: new Date().toISOString(),
    metrics: {
      ...payload.metrics,
      totalBusinesses: Math.max(0, payload.metrics.totalBusinesses - (business ? 1 : 0)),
      activeBusinesses: businesses.filter((candidate) => candidate.status.toLowerCase() === "active").length,
      monthlyRecurringRevenue:
        business?.status.toLowerCase() === "active"
          ? Math.max(0, payload.metrics.monthlyRecurringRevenue - business.currentSubscriptionAmount)
          : payload.metrics.monthlyRecurringRevenue
    },
    businesses
  };
}

function businessActionMessage(name: string, action: BusinessAction) {
  if (action === "approve") return `${name} approved and marked verified.`;
  if (action === "reject") return `${name} rejected. Corrected KYC documents are required before another review.`;
  if (action === "unapprove") return `${name} moved back to pending approval.`;
  if (action === "open") return `${name} marked open now.`;
  if (action === "close") return `${name} marked closed.`;
  if (action === "approveWhatsapp") return `${name} WhatsApp approved for live sends.`;
  if (action === "disableWhatsapp") return `${name} WhatsApp live sends disabled.`;
  if (action === "delete") return `${name} deleted.`;
  return `${name} suspended.`;
}

function isBusinessApproved(business: LiveAdminBusiness) {
  return business.kycStatus === "APPROVED" || business.kyc.toLowerCase() === "verified";
}

function businessPayoutEmailSkipReason(reason: BusinessPayoutEmailSkipReason) {
  if (reason === "payout_not_found") return "payout record was not found";
  if (reason === "missing_business_email") return "business email is missing";
  return "email was skipped";
}

function businessPayoutEmailNotice(email?: BusinessPayoutEmailResponse): { tone: "success" | "warning"; message: string } {
  if (!email) return { tone: "warning", message: "Email status was not returned." };
  switch (email.status) {
    case "queued":
      return { tone: "success", message: `Confirmation email queued for ${email.to}.` };
    case "placeholder":
      return { tone: "warning", message: "Email provider is not configured locally, so no live email was sent." };
    case "skipped":
      return { tone: "warning", message: `Confirmation email skipped because ${businessPayoutEmailSkipReason(email.reason)}.` };
    case "failed":
      return { tone: "warning", message: `Confirmation email failed: ${email.reason}` };
  }
}

async function readAdminActionError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data.error === "string") return data.error;
  } catch {
    return fallback;
  }

  return fallback;
}

function exportBusinesses(prefix: string, businesses: LiveAdminBusiness[]) {
  downloadCsv(
    `${prefix}-${dateStamp()}.csv`,
    businesses.map((business) => ({
      name: business.name,
      phone: business.phone,
      address: business.address,
      city: business.city,
      state: business.state,
      plan: business.plan,
      currentSubscriptionAmount: business.currentSubscriptionAmount,
      status: business.status,
      businessType: business.businessType,
      liveStatus: business.isOpen ? "Open" : "Closed",
      fulfillmentModes: fulfillmentModesSummary(business),
      latitude: business.latitude ?? "",
      longitude: business.longitude ?? "",
      serviceRadiusKm: business.serviceRadiusKm,
      serviceVisitFee: business.serviceVisitFee,
      platformFeeBps: business.platformFeeBps,
      payoutMethod: business.payoutMethod,
      payoutUpiId: business.payoutUpiId ?? "",
      payoutUpiName: business.payoutUpiName ?? "",
      payoutAccountHolderName: business.payoutAccountHolderName ?? "",
      payoutBankName: business.payoutBankName ?? "",
      payoutBankAccountNumber: business.payoutBankAccountNumber ?? "",
      payoutBankIfsc: business.payoutBankIfsc ?? "",
      setupCompletedAt: business.setupCompletedAt ?? "",
      walletGrossCredited: business.walletGrossCredited,
      walletPlatformFees: business.walletPlatformFees,
      walletPendingProviderSettlement: business.walletPendingProviderSettlement,
      walletAvailableForPayout: business.walletAvailableForPayout,
      walletProcessingPayouts: business.walletProcessingPayouts,
      walletPaidOut: business.walletPaidOut,
      revenue: business.revenue,
      orders: business.orders,
      customers: business.customers,
      kyc: business.kyc,
      kycStatus: business.kycStatus,
      kycDocuments: `${business.kycUploadedDocumentCount}/${business.kycRequiredDocumentCount}`,
      kycReadyForApproval: business.kycReadyForApproval ? "Yes" : "No",
      createdAt: business.createdAt
    }))
  );
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

const logStatusOrder: Record<string, number> = {
  FAILED: 0,
  PENDING: 1,
  QUEUED: 2,
  SENT: 3,
  DELIVERED: 4,
  ACTIVE: 5,
  COMPLETED: 6
};

function compareLogStatus(first: string, second: string) {
  return (logStatusOrder[first] ?? 99) - (logStatusOrder[second] ?? 99) || first.localeCompare(second);
}

function adminLogTimestamp(log: LiveAdminLog) {
  return log.occurredAt ? Date.parse(log.occurredAt) : 0;
}

function sortAdminPageLogs(logs: LiveAdminLog[]) {
  return [...logs].sort((first, second) => adminLogTimestamp(second) - adminLogTimestamp(first));
}

function adminLogSearchHaystack(log: LiveAdminLog) {
  return [
    log.source,
    log.action,
    log.entity,
    log.status,
    log.businessName,
    log.actorName,
    log.summary,
    log.detail,
    log.reference
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function adminLogSourceLabel(source: LiveAdminLog["source"]) {
  if (source === "whatsapp") return "WhatsApp";
  if (source === "payment") return "Payment";
  return "Audit";
}

function adminLogSourceVariant(source: LiveAdminLog["source"]): "blue" | "emerald" | "purple" {
  if (source === "whatsapp") return "emerald";
  if (source === "payment") return "purple";
  return "blue";
}

function adminLogStatusVariant(status: LiveAdminLog["status"]): "neutral" | "blue" | "emerald" | "purple" | "amber" | "red" {
  if (status === "FAILED") return "red";
  if (status === "PENDING" || status === "QUEUED") return "amber";
  if (status === "SENT" || status === "DELIVERED" || status === "COMPLETED" || status === "ACTIVE") return "emerald";
  return "blue";
}

function formatAdminLogStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAdminLogAction(action: string) {
  const acronyms = new Set(["API", "GST", "KYC", "PSHR", "QR", "UPI"]);
  return action
    .replaceAll(".", "_")
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (acronyms.has(upper)) return upper;
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function formatAdminLogDate(value: string | null) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatAdminLastSync(value: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function LogStatusBadge({ status, className }: { status: LiveAdminLog["status"]; className?: string }) {
  return (
    <Badge variant={adminLogStatusVariant(status)} className={className}>
      {formatAdminLogStatus(status)}
    </Badge>
  );
}

function LiveSyncStatus({ connected, source, error }: { connected: boolean; source: "database" | "demo"; error: string | null }) {
  if (error) {
    return <Badge variant="amber">Reconnecting</Badge>;
  }

  if (source === "demo") {
    return <Badge variant="purple">Demo</Badge>;
  }

  return <Badge variant={connected ? "emerald" : "blue"}>{connected ? "Connected" : "Updating"}</Badge>;
}
