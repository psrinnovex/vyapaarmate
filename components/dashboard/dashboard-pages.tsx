"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownToLine,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileCheck2,
  ImagePlus,
  IndianRupee,
  Landmark,
  LoaderCircle,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  TrendingUp,
  UploadCloud,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { DemoMenuItem } from "@/lib/demo-data";
import { useDashboardLive } from "@/hooks/use-live-sync";
import { BusinessImageUploadField } from "@/components/dashboard/business-image-upload-field";
import { KycUploadFeedbackDialog, type KycUploadFeedback } from "@/components/dashboard/kyc-upload-feedback-dialog";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { fulfillmentModeIcons, getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { getBusinessStaffRoleLabel } from "@/lib/business-staff-copy";
import { orderStatuses, type LiveBillingHistoryItem, type LiveDashboardPayload, type LiveOrder, type LiveOrderStatus, type LivePayment, type LivePaymentStatus } from "@/lib/live-types";
import { getOrderTrackingCopy, getOrderTrackingStatusActionLabel, getOrderTrackingStatusLabel } from "@/lib/order-tracking";
import {
  defaultFulfillmentModesForBusinessType,
  fulfillmentLabelForBusinessType,
  fulfillmentModeFlagNames,
  fulfillmentModesFromFlags,
  getBusinessFulfillmentProfile,
  isFoodBusinessType,
  isFulfillmentModeAllowedForBusinessType,
  type ActiveFulfillmentMode
} from "@/lib/business-rules";
import { optimizeMenuItemImage } from "@/lib/client-image";
import { pricingPlans } from "@/lib/constants";
import { cn, formatINR } from "@/lib/utils";
import { downloadCsv } from "@/lib/client-export";
import { formChecked, formNumber, formOptionalNumber, formString } from "@/lib/form-data";
import { ActionDialog, ActionNotice, type ActionNoticeState } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { Card, GlassPanel } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/form-fields";
import { BusinessTypeSelect } from "@/components/ui/business-type-select";
import { BusinessHoursEditor } from "@/components/ui/business-hours-editor";
import { BusinessLocationMapPicker } from "@/components/ui/business-location-map-picker";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/section";
import { DashboardPageSkeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Badge } from "@/components/ui/badge";
import { PaginationControls, usePaginatedItems } from "@/components/ui/pagination";
import { OrderStatusAnimation } from "@/components/ui/order-status-animation";
import { PaymentStatusAnimation } from "@/components/ui/payment-status-animation";

const selectClassName = "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10";
const campaignTemplates = [
  ["Status update template", "Confirmed, in-progress, ready, and completed updates."],
  ["Payment reminder template", "Pending-payment notice that returns the customer to the secure website checkout."],
  ["Repeat customer reminder", "Send only to marketing opted-in customers."],
  ["Festival offer campaign", "Consent-safe offer campaigns for local festivals."]
] as const;
type Campaign = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
};

type ManagedMenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
};

type ManagedMenuItem = DemoMenuItem & {
  categoryId: string;
};

type StaffMember = {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  role: string;
  roleValue?: string;
  permissions: string;
  status: string;
};

type StaffInviteState = {
  status?: "sent" | "placeholder" | "failed";
  devInviteUrl?: string;
  error?: string;
};

type SubscriptionPlanId = (typeof pricingPlans)[number]["id"];
type InvoiceMode = "customer" | "business";

type InvoiceTableRow = {
  id: string;
  kind: InvoiceMode;
  reference: string;
  subReference: string;
  party: string;
  partyDetail: string;
  issuedAt: string;
  amount: number;
  provider: string;
  paymentLabel: string;
  status: string;
  statusLabel: string;
  invoiceUrl: string;
};

type DeleteTarget =
  | { type: "order"; order: LiveOrder }
  | { type: "menu-item"; item: ManagedMenuItem }
  | { type: "menu-category"; category: ManagedMenuCategory }
  | { type: "customer"; customer: LiveDashboardPayload["customers"][number] }
  | { type: "staff"; member: StaffMember }
  | { type: "campaign"; campaign: Campaign };

type PayoutMethod = "UPI" | "BANK_TRANSFER";

function payoutMethodLabel(method: PayoutMethod) {
  return method === "UPI" ? "UPI" : "Bank transfer";
}

function titleCaseLabel(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleLabel(role: string, businessType = "") {
  return getBusinessStaffRoleLabel(role, businessType);
}

function staffInviteNotice(name: string, role: string, invite?: StaffInviteState) {
  if (invite?.status === "failed") {
    return `${name} was added as ${role}, but the invite email failed. Ask them to use Forgot password from the business login.`;
  }

  if (invite?.status === "placeholder" && invite.devInviteUrl) {
    return `${name} was added as ${role}. Local invite link: ${invite.devInviteUrl}`;
  }

  return `${name} invited as ${role}.`;
}

function dashboardTrackingOrderType(fulfillmentModes: LiveDashboardPayload["business"]["fulfillmentModes"]) {
  return fulfillmentModes[0] ?? "PICKUP";
}

function orderDecisionText(status: LiveOrderStatus, businessType: string, orderType: string) {
  if (status === "CANCELLED") return "declined";
  return getOrderTrackingStatusLabel(businessType, orderType, status).toLowerCase();
}

function nextOrderStatus(currentStatus: LiveOrderStatus) {
  const flow = orderStatuses.filter((status) => status !== "CANCELLED");
  if (currentStatus === "CANCELLED") return null;
  const currentIndex = flow.indexOf(currentStatus);
  return currentIndex >= 0 ? flow[currentIndex + 1] ?? null : null;
}

function orderStatusActionDisabled(currentStatus: LiveOrderStatus, targetStatus: LiveOrderStatus) {
  if (currentStatus === "CANCELLED" || currentStatus === "DELIVERED") return true;
  if (targetStatus === "CANCELLED") return false;
  return targetStatus !== nextOrderStatus(currentStatus);
}

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

export function DashboardOverviewPage() {
  const { data, connected, error, loading } = useDashboardLive();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const TransactionIcon = icons.transactionIcon;
  const CustomerIcon = icons.customerIcon;
  const ItemIcon = icons.itemIcon;
  const defaultOrderType = dashboardTrackingOrderType(data.business.fulfillmentModes);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const statusRows = orderStatuses
    .filter((status) => status !== "CANCELLED")
    .map((status) => ({
      status,
      label: getOrderTrackingStatusLabel(data.business.businessType, defaultOrderType, status),
      count: data.statusCounts[status],
      color: statusBarColor(status)
    }));

  if (loading) return <DashboardPageSkeleton variant="overview" />;

  return (
    <>
      <PageHeader
        title="Overview"
        body={`Operating view for ${copy.transactionPlural.toLowerCase()}, revenue, pending payments, repeat ${copy.customerPlural.toLowerCase()}, and ${copy.topItemsTitle.toLowerCase()}.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button
              variant="emerald"
              icon={<MessageCircle className="size-4" />}
              onClick={() => setNotice({ tone: "success", message: `Daily WhatsApp summary queued for ${data.business.name}.` })}
            >
              Send Daily Summary
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={`Today's ${copy.transactionPlural.toLowerCase()}`} value={String(data.metrics.ordersToday)} detail={`${data.orders.length} ${copy.transactionPlural.toLowerCase()} loaded`} icon={TransactionIcon} tone="blue" />
        <MetricCard title="Today's revenue" value={formatINR(data.metrics.revenueToday)} detail="Completed payments today" icon={IndianRupee} tone="emerald" />
        <MetricCard title="Pending payments" value={formatINR(data.metrics.pendingPaymentsAmount)} detail={`${data.metrics.pendingPaymentsCount} reminders due`} icon={CreditCard} tone="amber" />
        <MetricCard title={`Repeat ${copy.customerPlural.toLowerCase()}`} value={`${data.metrics.repeatRate}%`} detail={`${data.metrics.repeatCustomers} of ${data.metrics.totalCustomers} ${copy.customerPlural.toLowerCase()}`} icon={CustomerIcon} tone="purple" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <TransactionIcon className="size-5 text-ocean" />
              {copy.transactionSingular} status chart
            </h2>
            <Badge variant="blue">Today</Badge>
          </div>
          <div className="mt-6 grid gap-4">
            {statusRows.map(({ status, label, count, color }) => (
              <div key={status} className="grid grid-cols-[136px_1fr_34px] items-center gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-600">
                  <OrderStatusAnimation
                    status={status}
                    businessType={data.business.businessType}
                    orderType={defaultOrderType}
                    label={label}
                    className="size-8"
                  />
                  <span className="truncate">{label.toLowerCase()}</span>
                </span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`${color} h-full rounded-full`} style={{ width: `${Math.min(100, count * 12)}%` }} />
                </div>
                <span className="text-right font-bold text-ink">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <ItemIcon className="size-5 text-ocean" />
            <h2 className="text-lg font-bold text-ink">{copy.topItemsTitle}</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {data.topItems.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-mist p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-white text-sm font-bold text-ocean">{index + 1}</span>
                  <div>
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.category}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald">{formatINR(item.price)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <TransactionIcon className="size-5 text-ocean" />
            {copy.recentTransactionsTitle}
          </h2>
          <Link href="/dashboard/orders" className="text-sm font-bold text-ocean">View all</Link>
        </div>
        <ResponsiveOrderTable orders={data.recentOrders} transactionLabel={copy.transactionSingular} businessType={data.business.businessType} />
      </Card>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function DashboardOrderLane({
  header,
  orders,
  businessType,
  transactionPlural,
  statusPillLabel,
  onSelect
}: {
  header: ReactNode;
  orders: LiveOrder[];
  businessType: string;
  transactionPlural: string;
  statusPillLabel: (status: string, orderType?: LiveOrder["orderType"]) => string | undefined;
  onSelect: (order: LiveOrder) => void;
}) {
  const pagination = usePaginatedItems(orders, {
    resetKey: `${orders.length}-${orders[0]?.id ?? "empty"}-${orders.at(-1)?.id ?? "empty"}`
  });

  return (
    <Card className="min-w-0 overflow-hidden">
      {header}
      <div className="mt-4 grid gap-3">
        {pagination.pageItems.map((order) => (
          <button type="button" key={order.id} onClick={() => onSelect(order)} className="min-w-0 overflow-hidden rounded-lg border border-line bg-mist p-3 text-left transition hover:border-ocean/40">
            <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3">
              <OrderStatusAnimation
                status={order.status}
                businessType={businessType}
                orderType={order.orderType}
                label={statusPillLabel(order.status, order.orderType)}
                className="size-10 shrink-0"
              />
              <div className="min-w-0">
                <p className="break-words font-bold leading-6 text-ink [overflow-wrap:anywhere]" title={order.orderNumber}>{order.orderNumber}</p>
                <StatusPill status={order.status} label={statusPillLabel(order.status, order.orderType)} className="mt-2 w-fit whitespace-normal text-left leading-5" />
              </div>
            </div>
            <p className="mt-2 break-words text-sm text-slate-600">{order.customer}</p>
            <p className="break-words text-sm text-slate-500">{order.items}</p>
            <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm font-bold">
              <span className="shrink-0">{formatINR(order.amount)}</span>
              <span className="flex min-w-0 items-center gap-2">
                <PaymentStatusAnimation status={order.paymentStatus} label={`${order.paymentStatus.toLowerCase()} payment`} className="size-7" />
                <StatusPill status={order.paymentStatus} className="whitespace-normal leading-5" />
              </span>
            </div>
          </button>
        ))}
        {orders.length === 0 && (
          <p className="rounded-lg bg-mist p-3 text-sm text-slate-500">No {transactionPlural.toLowerCase()} in this lane.</p>
        )}
      </div>
      <PaginationControls
        className="mt-4 border-t-0 px-0 pb-0"
        page={pagination.page}
        pageCount={pagination.pageCount}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        itemLabel={transactionPlural.toLowerCase()}
        onPageChange={pagination.setPage}
      />
    </Card>
  );
}

type OrdersPageView = "operations" | "history";

export function OrdersPage({ view = "operations" }: { view?: OrdersPageView } = {}) {
  const { data, setData, connected, error, loading, refresh } = useDashboardLive();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const TransactionIcon = icons.transactionIcon;
  const defaultOrderType = dashboardTrackingOrderType(data.business.fulfillmentModes);
  const tracking = getOrderTrackingCopy(data.business.businessType, defaultOrderType);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [updatingOrder, setUpdatingOrder] = useState<{ id: string; status: LiveOrderStatus } | null>(null);
  const selectedBookingParam = searchParams.get("booking");
  const statuses = [...orderStatuses, "PENDING", "COMPLETED"];
  const statusPillLabel = (status: string, orderType: LiveOrder["orderType"] = defaultOrderType) =>
    orderStatuses.includes(status as LiveOrderStatus)
      ? getOrderTrackingStatusLabel(data.business.businessType, orderType, status)
      : undefined;
  const columns = [
    { title: copy.newTransactionsTitle, statuses: ["NEW", "ACCEPTED"] as LiveOrderStatus[] },
    { title: getOrderTrackingStatusLabel(data.business.businessType, defaultOrderType, "PREPARING"), statuses: ["PREPARING"] as LiveOrderStatus[] },
    { title: getOrderTrackingStatusLabel(data.business.businessType, defaultOrderType, "READY"), statuses: ["READY"] as LiveOrderStatus[] }
  ];
  const operationsTitle = copy.transactionPlural;
  const historyTitle = `${copy.transactionSingular} History`;
  const ordersBasePath = view === "history" ? "/dashboard/orders/history" : "/dashboard/orders";
  const selectedLookup = selectedOrderId ?? selectedBookingParam;
  const selected = useMemo(
    () => data.orders.find((order) => order.id === selectedLookup || order.orderNumber === selectedLookup) ?? null,
    [data.orders, selectedLookup]
  );
  const selectOrder = useCallback((order: LiveOrder) => {
    setSelectedOrderId(order.id);
  }, []);
  const closeSelectedOrder = useCallback(() => {
    setSelectedOrderId(null);
    if (selectedBookingParam) router.replace(ordersBasePath, { scroll: false });
  }, [ordersBasePath, router, selectedBookingParam]);

  if (loading) return <DashboardPageSkeleton variant="orders" />;

  async function updateOrderStatus(order: LiveOrder, status: LiveOrderStatus) {
    const updatedOrder = { ...order, status };
    const decisionText = orderDecisionText(status, data.business.businessType, order.orderType);

    if (data.source !== "database") {
      setData((current) => replaceOrder(current, updatedOrder));
      setNotice({ tone: "success", message: `${copy.transactionSingular} ${order.orderNumber} marked ${decisionText}.` });
      return;
    }

    setUpdatingOrder({ id: order.id, status });
    setNotice(null);

    try {
      const response = await fetch(`/api/dashboard/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        await refresh();
        setNotice({
          tone: "error",
          message: await readActionError(response, `Could not update ${copy.transactionSingular.toLowerCase()} ${order.orderNumber}. Data was refreshed.`)
        });
        return;
      }

      const payload = (await response.json().catch(() => null)) as { order?: Pick<LiveOrder, "status" | "paymentStatus"> } | null;
      const persistedOrder = {
        ...updatedOrder,
        status: payload?.order?.status ?? status,
        paymentStatus: payload?.order?.paymentStatus ?? order.paymentStatus
      };
      setData((current) => replaceOrder(current, persistedOrder));
      await refresh();
      setNotice({ tone: "success", message: `${copy.transactionSingular} ${order.orderNumber} saved as ${orderDecisionText(persistedOrder.status, data.business.businessType, order.orderType)}.` });
    } catch {
      await refresh();
      setNotice({ tone: "error", message: `Could not reach the server. ${copy.transactionSingular} ${order.orderNumber} was refreshed from saved data.` });
    } finally {
      setUpdatingOrder((current) => (current?.id === order.id ? null : current));
    }
  }

  async function sendOrderUpdate(order: LiveOrder) {
    if (!data.business.whatsappLiveEnabled) {
      setNotice({ tone: "error", message: "WhatsApp is not enabled for this business. Website order updates remain available in the dashboard." });
      return false;
    }

    if (data.source !== "database") {
      setNotice({ tone: "success", message: `WhatsApp update queued for ${order.orderNumber}.` });
      return true;
    }

    const response = await fetch(`/api/dashboard/orders/${encodeURIComponent(order.id)}/whatsapp`, {
      method: "POST"
    });

    if (!response.ok) {
      setNotice({ tone: "error", message: await readActionError(response, `Could not send WhatsApp update for ${order.orderNumber}.`) });
      return false;
    }

    setNotice({ tone: "success", message: `WhatsApp update sent for ${order.orderNumber}.` });
    return true;
  }

  async function sendActiveOrderUpdates() {
    const activeOrders = data.orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status));
    if (activeOrders.length === 0) {
      setNotice({ tone: "error", message: `No active ${copy.transactionPlural.toLowerCase()} to update.` });
      return;
    }

    let sent = 0;
    for (const order of activeOrders) {
      const ok = await sendOrderUpdate(order);
      if (ok) sent += 1;
    }
    setNotice({ tone: sent > 0 ? "success" : "error", message: `${sent} WhatsApp updates sent for active ${copy.transactionPlural.toLowerCase()}.` });
  }

  async function deleteOrder(order: LiveOrder) {
    setDeleteTarget(null);
    closeSelectedOrder();
    setData((current) => removeOrder(current, order.id));

    if (data.source !== "database") {
      setNotice({ tone: "success", message: `${copy.transactionSingular} ${order.orderNumber} deleted.` });
      return;
    }

    const response = await fetch(`/api/dashboard/orders/${encodeURIComponent(order.id)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      await refresh();
      setNotice({ tone: "error", message: `Could not delete ${copy.transactionSingular.toLowerCase()} ${order.orderNumber}. Data was refreshed.` });
      return;
    }

    await refresh();
    setNotice({ tone: "success", message: `${copy.transactionSingular} ${order.orderNumber} deleted permanently.` });
  }

  return (
    <>
      <PageHeader
        title={view === "history" ? historyTitle : operationsTitle}
        body={view === "history"
          ? `All ${copy.transactionPlural.toLowerCase()} for this business, including active, completed, cancelled, and payment states.`
          : `Move ${copy.transactionPlural.toLowerCase()} through ${tracking.stages.slice(1).map((stage) => stage.label.toLowerCase()).join(", ")}, or cancelled. Payment state is tracked separately.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            {view === "operations" && (
              <Button
                variant="emerald"
                icon={<MessageCircle className="size-4" />}
                onClick={sendActiveOrderUpdates}
              >
                Send WhatsApp Update
              </Button>
            )}
          </div>
        }
      />
      {view === "operations" ? (
        <>
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-3">
            {statuses.map((status) => <StatusPill key={status} status={status} label={statusPillLabel(status)} className="shrink-0" />)}
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {columns.map((column) => (
              <DashboardOrderLane
                key={column.title}
                header={
                  <div className="flex items-center gap-2">
                    <TransactionIcon className="size-4 text-ocean" />
                    <h2 className="font-bold text-ink">{column.title}</h2>
                  </div>
                }
                orders={data.orders.filter((order) => column.statuses.includes(order.status))}
                businessType={data.business.businessType}
                transactionPlural={copy.transactionPlural}
                statusPillLabel={statusPillLabel}
                onSelect={selectOrder}
              />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink">{historyTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                All {copy.transactionPlural.toLowerCase()} for this business, including active, completed, cancelled, and payment states.
              </p>
            </div>
            <Badge variant="neutral">{data.orders.length} total</Badge>
          </div>
          {data.orders.length > 0 ? (
            <ResponsiveOrderTable orders={data.orders} transactionLabel={copy.transactionSingular} businessType={data.business.businessType} />
          ) : (
            <p className="mt-4 rounded-lg bg-mist p-4 text-sm text-slate-500">No {copy.transactionPlural.toLowerCase()} have been created yet.</p>
          )}
        </Card>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-4 sm:place-items-center">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <OrderStatusAnimation
                  status={selected.status}
                  businessType={data.business.businessType}
                  orderType={selected.orderType}
                  label={statusPillLabel(selected.status, selected.orderType)}
                  className="size-14"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-ink">{selected.orderNumber}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selected.customer} - {selected.time}</p>
                </div>
              </div>
              <button type="button" className="text-sm font-bold text-ocean" onClick={closeSelectedOrder}>Close</button>
            </div>
            <div className="mt-5 grid gap-3">
              <p className="rounded-lg bg-mist p-3 text-sm text-slate-700">{selected.items}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {["ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"].map((status) => {
                  const targetStatus = status as LiveOrderStatus;
                  const saving = updatingOrder?.id === selected.id && updatingOrder.status === targetStatus;
                  const blocked = orderStatusActionDisabled(selected.status, targetStatus);

                  return (
                    <Button
                      key={status}
                      type="button"
                      variant="secondary"
                      icon={saving ? <LoaderCircle className="size-4 animate-spin" /> : undefined}
                      onClick={() => updateOrderStatus(selected, targetStatus)}
                      disabled={updatingOrder?.id === selected.id || blocked}
                    >
                      {saving
                          ? "Saving"
                          : getOrderTrackingStatusActionLabel(data.business.businessType, selected.orderType, status)}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="emerald"
                icon={<MessageCircle className="size-4" />}
                onClick={() => sendOrderUpdate(selected)}
              >
                Send WhatsApp Update
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setDeleteTarget({ type: "order", order: selected })}
              >
                Delete {copy.transactionSingular}
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget?.type === "order" && (
        <ActionDialog
          title={`Delete ${copy.transactionSingular.toLowerCase()}`}
          body={`${deleteTarget.order.orderNumber} will be permanently removed from ${copy.transactionPlural.toLowerCase()}, payments, and reports.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteOrder(deleteTarget.order)}>
              Delete {copy.transactionSingular}
            </Button>
          </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function MenuManagementPage() {
  const { data, loading: liveLoading } = useDashboardLive();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const CategoryIcon = icons.categoryIcon;
  const ItemIcon = icons.itemIcon;
  const isFoodBusiness = isFoodBusinessType(data.business.businessType);
  const addCategoryLabel = `Add ${titleCaseLabel(copy.categorySingular)}`;
  const [items, setItems] = useState<ManagedMenuItem[]>([]);
  const [categories, setCategories] = useState<ManagedMenuCategory[]>([]);
  const [menuDialog, setMenuDialog] = useState<{ mode: "add"; categoryId?: string } | { mode: "edit"; item: ManagedMenuItem } | null>(null);
  const [menuImagePreview, setMenuImagePreview] = useState<string | null>(null);
  const [pendingMenuImage, setPendingMenuImage] = useState<string | null | undefined>(undefined);
  const [isProcessingMenuImage, setIsProcessingMenuImage] = useState(false);
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const newMenuItemIdRef = useRef(0);
  const menuLoadedRef = useRef(false);

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const response = await fetch("/api/dashboard/menu", { cache: "no-store" });
      if (!response.ok) throw new Error(`Menu load failed with ${response.status}`);

      const payload = (await response.json()) as {
        categories: ManagedMenuCategory[];
        items: ManagedMenuItem[];
      };
      setCategories(payload.categories);
      setItems(payload.items);
    } catch {
      setCategories([]);
      setItems([]);
    } finally {
      menuLoadedRef.current = true;
      setMenuLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMenu();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMenu]);

  useEffect(() => {
    if (menuLoadedRef.current) void loadMenu();
  }, [data.syncedAt, loadMenu]);

  const categorySections = useMemo(() => {
    const knownCategoryIds = new Set(categories.map((category) => category.id));
    const itemsByCategory = new Map<string, ManagedMenuItem[]>();
    const uncategorizedItems: ManagedMenuItem[] = [];

    categories.forEach((category) => itemsByCategory.set(category.id, []));
    items.forEach((item) => {
      if (!knownCategoryIds.has(item.categoryId)) {
        uncategorizedItems.push(item);
        return;
      }

      itemsByCategory.get(item.categoryId)?.push(item);
    });

    return [
      ...categories.map((category) => ({
        id: category.id,
        category,
        name: category.name,
        sortOrder: category.sortOrder,
        items: itemsByCategory.get(category.id) ?? []
      })),
      ...(uncategorizedItems.length > 0
        ? [{
            id: "uncategorized",
            category: null,
            name: "Uncategorized",
            sortOrder: null,
            items: uncategorizedItems
          }]
        : [])
    ];
  }, [categories, items]);

  if (liveLoading || menuLoading) return <DashboardPageSkeleton variant="catalog" />;

  function openMenuDialog(dialog: { mode: "add"; categoryId?: string } | { mode: "edit"; item: ManagedMenuItem }) {
    setMenuImagePreview(dialog.mode === "edit" ? dialog.item.imageUrl : null);
    setPendingMenuImage(undefined);
    setMenuDialog(dialog);
  }

  function closeMenuDialog() {
    setMenuDialog(null);
    setMenuImagePreview(null);
    setPendingMenuImage(undefined);
    setIsProcessingMenuImage(false);
  }

  async function handleMenuImageChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setIsProcessingMenuImage(true);
    try {
      const imageDataUrl = await optimizeMenuItemImage(file);
      setMenuImagePreview(imageDataUrl);
      setPendingMenuImage(imageDataUrl);
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not process this image." });
    } finally {
      setIsProcessingMenuImage(false);
      input.value = "";
    }
  }

  async function submitMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const categoryId = formString(formData, "categoryId", categories[0]?.id ?? "");
    const category = categories.find((candidate) => candidate.id === categoryId);
    const name = formString(formData, "name", `New ${copy.itemSingular.toLowerCase()}`);
    if (!category) {
      setNotice({ tone: "error", message: "Select a category before saving the item." });
      return;
    }

    const item: ManagedMenuItem = {
      id: menuDialog?.mode === "edit" ? menuDialog.item.id : `item_local_${++newMenuItemIdRef.current}`,
      name,
      categoryId: category.id,
      category: category.name,
      description: formString(formData, "description", `${copy.itemSingular} description`),
      price: formNumber(formData, "price", 0),
      foodType: formString(formData, "foodType", isFoodBusiness ? "VEG" : "NOT_APPLICABLE") as DemoMenuItem["foodType"],
      imageUrl: menuDialog?.mode === "edit" ? menuDialog.item.imageUrl : null,
      isAvailable: formChecked(formData, "isAvailable"),
      isBestSeller: formChecked(formData, "isBestSeller")
    };

    setIsSavingMenuItem(true);
    try {
      const response = await fetch(menuDialog?.mode === "edit" ? `/api/dashboard/menu/${encodeURIComponent(item.id)}` : "/api/dashboard/menu", {
        method: menuDialog?.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          foodType: item.foodType,
          isAvailable: item.isAvailable,
          isBestSeller: Boolean(item.isBestSeller),
          ...(pendingMenuImage === undefined ? {} : { imageDataUrl: pendingMenuImage })
        })
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          message: await readActionError(response, `Could not ${menuDialog?.mode === "edit" ? "update" : "add"} ${name}.`)
        });
        return;
      }

      await loadMenu();
      closeMenuDialog();
      setNotice({ tone: "success", message: `${name} ${menuDialog?.mode === "edit" ? "updated" : "added"} successfully.` });
    } catch {
      setNotice({ tone: "error", message: `Could not ${menuDialog?.mode === "edit" ? "update" : "add"} ${name}.` });
    } finally {
      setIsSavingMenuItem(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formString(new FormData(event.currentTarget), "category");
    if (!name) return;

    const response = await fetch("/api/dashboard/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      setNotice({ tone: "error", message: `Could not add ${name}. It may already exist.` });
      return;
    }

    await loadMenu();
    setCategoryDialogOpen(false);
    setNotice({ tone: "success", message: `${name} ${copy.categorySingular.toLowerCase()} added.` });
  }

  async function deleteMenuItem(item: ManagedMenuItem) {
    setDeleteTarget(null);

    const response = await fetch(`/api/dashboard/menu/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice({ tone: "error", message: `Could not delete ${item.name}.` });
      return;
    }

    await loadMenu();
    setNotice({ tone: "success", message: `${item.name} deleted.` });
  }

  async function deleteCategory(category: ManagedMenuCategory) {
    setDeleteTarget(null);

    const response = await fetch(`/api/dashboard/menu/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice({ tone: "error", message: `Could not delete ${category.name}.` });
      return;
    }

    await loadMenu();
    setNotice({ tone: "success", message: `${category.name} category deleted.` });
  }

  return (
    <>
      <PageHeader
        title={copy.catalogTitle}
        body={copy.catalogBody}
        action={
          <Button variant="emerald" icon={<CategoryIcon className="size-4" />} onClick={() => setCategoryDialogOpen(true)}>
            {addCategoryLabel}
          </Button>
        }
      />
      <div className="grid gap-7">
        {categories.length === 0 && (
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-500">Add a {copy.categorySingular.toLowerCase()} first, then place related {copy.itemPlural.toLowerCase()} under it.</p>
              <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setCategoryDialogOpen(true)}>
                Add {copy.categorySingular}
              </Button>
            </div>
          </Card>
        )}

        {categorySections.map((section) => (
          <section key={section.id} className="border-t border-line pt-5 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ocean/10 text-ocean">
                  <CategoryIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-extrabold text-ink [overflow-wrap:anywhere]">{section.name}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {section.items.length} {section.items.length === 1 ? copy.itemSingular.toLowerCase() : copy.itemPlural.toLowerCase()}
                    {section.sortOrder !== null ? ` - Sort ${section.sortOrder}` : ""}
                  </p>
                </div>
              </div>
              {section.category && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="size-4" />}
                    onClick={() => openMenuDialog({ mode: "add", categoryId: section.category.id })}
                  >
                    {copy.addItemLabel}
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${section.name}`}
                    title={`Delete ${section.name}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                    onClick={() => setDeleteTarget({ type: "menu-category", category: section.category })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {section.items.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                {section.items.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="relative aspect-[5/4] overflow-hidden rounded-lg bg-mist">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 220px" className="object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-ocean">
                          <ItemIcon className="size-9" />
                        </div>
                      )}
                      {item.isBestSeller && (
                        <Badge variant="amber" className="absolute left-2 top-2 bg-amber-100/95">
                          Popular
                        </Badge>
                      )}
                      <div className="absolute right-2 top-2 flex gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${item.name}`}
                          title={`Edit ${item.name}`}
                          className="grid size-8 place-items-center rounded-lg bg-white/95 text-ink shadow-sm ring-1 ring-line transition hover:bg-slate-50"
                          onClick={() => openMenuDialog({ mode: "edit", item })}
                        >
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.name}`}
                          title={`Delete ${item.name}`}
                          className="grid size-8 place-items-center rounded-lg bg-red-50/95 text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-100"
                          onClick={() => setDeleteTarget({ type: "menu-item", item })}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 min-w-0">
                      <h3 className="line-clamp-2 min-h-10 break-words text-sm font-bold leading-5 text-ink [overflow-wrap:anywhere]">{item.name}</h3>
                      <p className="mt-1 text-sm font-extrabold text-ocean">{formatINR(item.price)}</p>
                      <p className="mt-2 line-clamp-2 min-h-10 break-words text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">{item.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-line bg-white/70 p-4 text-sm text-slate-500">
                No {copy.itemPlural.toLowerCase()} in this {copy.categorySingular.toLowerCase()} yet.
              </div>
            )}
          </section>
        ))}

      </div>
      {categoryDialogOpen && (
        <ActionDialog title={`Add ${copy.categorySingular.toLowerCase()}`} onClose={() => setCategoryDialogOpen(false)}>
          <form className="grid gap-4" onSubmit={submitCategory}>
            <div className="grid gap-2">
              <Label>{copy.categorySingular} name</Label>
              <Input name="category" required autoFocus placeholder="Beverages" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="emerald">Save {copy.categorySingular}</Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {menuDialog && (
        <ActionDialog
          title={menuDialog.mode === "edit" ? `Edit ${copy.itemSingular.toLowerCase()}` : copy.addItemLabel}
          body={`Update the ${copy.itemSingular.toLowerCase()} details shown on the customer page.`}
          onClose={closeMenuDialog}
        >
          <form className="grid gap-4" onSubmit={submitMenuItem}>
            <div className="grid gap-2">
              <Label>{copy.itemSingular} name</Label>
              <Input name="name" required autoFocus defaultValue={menuDialog.mode === "edit" ? menuDialog.item.name : ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category</Label>
                <select name="categoryId" className={selectClassName} defaultValue={menuDialog.mode === "edit" ? menuDialog.item.categoryId : menuDialog.categoryId ?? categories[0]?.id}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Price</Label>
                <Input name="price" type="number" min="0" required defaultValue={menuDialog.mode === "edit" ? menuDialog.item.price : 0} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea name="description" required defaultValue={menuDialog.mode === "edit" ? menuDialog.item.description : ""} />
            </div>
            <div className="grid gap-2">
              <Label>{copy.itemSingular} photo</Label>
              <div className="grid gap-3 rounded-xl border border-line bg-mist/60 p-3 sm:grid-cols-[160px_1fr] sm:items-center">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white">
                  {menuImagePreview ? (
                    <Image
                      src={menuImagePreview}
                      alt={`${copy.itemSingular} preview`}
                      fill
                      sizes="160px"
                      className="object-cover"
                      unoptimized={menuImagePreview.startsWith("data:")}
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-400">
                      <ImagePlus className="size-8" />
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ocean shadow-sm ring-1 ring-line transition hover:bg-slate-50">
                    {isProcessingMenuImage ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    {isProcessingMenuImage ? "Optimizing..." : menuImagePreview ? "Replace photo" : "Add photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={isProcessingMenuImage || isSavingMenuItem}
                      onChange={handleMenuImageChange}
                    />
                  </label>
                  {menuImagePreview && (
                    <button
                      type="button"
                      className="h-10 rounded-lg px-4 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      disabled={isProcessingMenuImage || isSavingMenuItem}
                      onClick={() => {
                        setMenuImagePreview(null);
                        setPendingMenuImage(null);
                      }}
                    >
                      Remove photo
                    </button>
                  )}
                  <p className="text-xs leading-5 text-slate-500">JPG, PNG, or WebP up to 10 MB. Stored as an optimized WebP up to 1280 px and 500 KB.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {isFoodBusiness ? (
                <div className="grid gap-2">
                  <Label>Food marker</Label>
                  <select name="foodType" className={selectClassName} defaultValue={menuDialog.mode === "edit" ? menuDialog.item.foodType : "VEG"}>
                    <option value="VEG">Veg</option>
                    <option value="NON_VEG">Non veg</option>
                    <option value="EGG">Egg</option>
                    <option value="NOT_APPLICABLE">Not applicable</option>
                  </select>
                </div>
              ) : (
                <input name="foodType" type="hidden" value="NOT_APPLICABLE" />
              )}
              <div className="grid content-end gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input name="isAvailable" type="checkbox" defaultChecked={menuDialog.mode !== "edit" || menuDialog.item.isAvailable} />
                  Available
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input name="isBestSeller" type="checkbox" defaultChecked={menuDialog.mode === "edit" && Boolean(menuDialog.item.isBestSeller)} />
                  Best seller
                </label>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={isSavingMenuItem} onClick={closeMenuDialog}>Cancel</Button>
              <Button type="submit" variant="emerald" disabled={isProcessingMenuImage || isSavingMenuItem}>
                {isSavingMenuItem ? "Saving..." : menuDialog.mode === "edit" ? `Save ${copy.itemSingular}` : copy.addItemLabel}
              </Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {deleteTarget?.type === "menu-item" && (
        <ActionDialog
          title={`Delete ${copy.itemSingular.toLowerCase()}`}
          body={`${deleteTarget.item.name} will be removed from the live ${copy.catalogNavLabel.toLowerCase()}. Existing ${copy.transactionSingular.toLowerCase()} history keeps the ${copy.itemSingular.toLowerCase()} name.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteMenuItem(deleteTarget.item)}>
              Delete {copy.itemSingular}
            </Button>
          </div>
        </ActionDialog>
      )}
      {deleteTarget?.type === "menu-category" && (
        <ActionDialog
          title={`Delete ${copy.categorySingular.toLowerCase()}`}
          body={`${deleteTarget.category.name} and ${deleteTarget.category.itemCount} ${copy.itemSingular.toLowerCase()}${deleteTarget.category.itemCount === 1 ? "" : "s"} will be permanently removed.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteCategory(deleteTarget.category)}>
              Delete {copy.categorySingular}
            </Button>
          </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function CustomersPage() {
  const { data, setData, connected, error, loading, refresh } = useDashboardLive();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const CustomerIcon = icons.customerIcon;
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const customerPagination = usePaginatedItems(data.customers, {
    resetKey: `${data.customers.length}-${data.customers[0]?.id ?? "empty"}-${data.customers.at(-1)?.id ?? "empty"}`
  });

  if (loading) return <DashboardPageSkeleton variant="table" />;

  function exportCustomers() {
    downloadCsv(
      `vyapaarmate-customers-${dateStamp()}.csv`,
      data.customers.map((customer) => ({
        name: customer.name,
        phone: customer.phone,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        lastOrdered: customer.lastOrdered,
        favouriteItems: customer.favouriteItems,
        whatsappOptIn: customer.whatsappOptIn,
        marketingOptIn: customer.marketingOptIn
      }))
    );
    setNotice({ tone: "success", message: `${data.customers.length} ${copy.customerPlural.toLowerCase()} exported to CSV.` });
  }

  async function deleteCustomer(customer: LiveDashboardPayload["customers"][number]) {
    setDeleteTarget(null);
    setData((current) => removeCustomer(current, customer));

    if (data.source !== "database") {
      setNotice({ tone: "success", message: `${customer.name} deleted.` });
      return;
    }

    const response = await fetch(`/api/dashboard/customers/${encodeURIComponent(customer.id)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      await refresh();
      setNotice({ tone: "error", message: `Could not delete ${customer.name}. Data was refreshed.` });
      return;
    }

    await refresh();
    setNotice({ tone: "success", message: `${customer.name} and related customer records were deleted.` });
  }

  return (
    <>
      <PageHeader
        title={`${copy.customerPlural} CRM`}
        body={`Track ${copy.transactionPlural.toLowerCase()}, spend, favourites, consent, last ${copy.transactionSingular.toLowerCase()} dates, reminders, and exports.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button variant="secondary" icon={<ArrowDownToLine className="size-4" />} onClick={exportCustomers}>
              Export CSV
            </Button>
          </div>
        }
      />
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-mist text-xs uppercase text-slate-500">
              <tr>
                {[copy.customerSingular, "Phone", copy.transactionPlural, "Spent", `Last ${copy.transactionSingular.toLowerCase()}`, "Favourite", "Consent", "Action"].map((head) => (
                  <th key={head} className="px-4 py-3 font-bold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customerPagination.pageItems.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 font-bold text-ink">
                      <CustomerIcon className="size-4 shrink-0 text-ocean" />
                      <span>{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{customer.phone}</td>
                  <td className="px-4 py-4">{customer.totalOrders}</td>
                  <td className="px-4 py-4 font-bold">{formatINR(customer.totalSpent)}</td>
                  <td className="px-4 py-4 text-slate-600">{customer.lastOrdered}</td>
                  <td className="px-4 py-4 text-slate-600">{customer.favouriteItems}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      {customer.whatsappOptIn && <Badge variant="emerald">Updates</Badge>}
                      {customer.marketingOptIn && <Badge variant="purple">Offers</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Bell className="size-4" />}
                        onClick={() => setNotice({ tone: "success", message: `Reminder queued for ${customer.name}.` })}
                      >
                        Reminder
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="size-4" />}
                        onClick={() => setDeleteTarget({ type: "customer", customer })}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={customerPagination.page}
          pageCount={customerPagination.pageCount}
          totalItems={customerPagination.totalItems}
          startItem={customerPagination.startItem}
          endItem={customerPagination.endItem}
          itemLabel={copy.customerPlural.toLowerCase()}
          onPageChange={customerPagination.setPage}
        />
      </Card>
      {deleteTarget?.type === "customer" && (
        <ActionDialog
          title={`Delete ${copy.customerSingular.toLowerCase()}`}
          body={`${deleteTarget.customer.name}, their ${copy.transactionSingular.toLowerCase()} history, and their WhatsApp message rows will be permanently removed.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteCustomer(deleteTarget.customer)}>
              Delete {copy.customerSingular}
            </Button>
          </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function PaymentsPage() {
  const { data, connected, error, loading, refresh } = useDashboardLive();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const TransactionIcon = icons.transactionIcon;
  const paidOrders = data.payments.filter((payment) => payment.status === "COMPLETED").length;
  const wallet = data.wallet;
  const [collectingPaymentId, setCollectingPaymentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const paymentPagination = usePaginatedItems(data.payments, {
    resetKey: `${data.payments.length}-${data.payments[0]?.id ?? "empty"}-${data.payments.at(-1)?.id ?? "empty"}`
  });

  if (loading) return <DashboardPageSkeleton variant="table" />;

  async function markPaymentCollected(paymentId: string, orderNumber: string) {
    setCollectingPaymentId(paymentId);
    setNotice(null);
    try {
      const response = await fetch(`/api/dashboard/payments/${encodeURIComponent(paymentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" })
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readActionError(response, `Could not record payment for ${orderNumber}.`) });
        return;
      }
      await refresh();
      setNotice({ tone: "success", message: `Payment marked paid for ${orderNumber}. The invoice now shows paid.` });
    } finally {
      setCollectingPaymentId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Payments"
        body={`Track platform-collected online payments, business wallet credits, cash records, and customer invoices.`}
        action={<LiveSyncStatus connected={connected} source={data.source} error={error} />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title={`Paid ${copy.transactionPlural.toLowerCase()}`} value={String(paidOrders)} detail="Payment rows" icon={TransactionIcon} tone="emerald" />
        <MetricCard title="Wallet available" value={formatINR(wallet.availableForPayout)} detail="Ready for PSHR payout" icon={Wallet} tone="blue" />
        <MetricCard title="Payout processing" value={formatINR(wallet.processingPayouts)} detail="Sent to bank or UPI" icon={ArrowLeftRight} tone="amber" />
        <MetricCard title="9 AM payout batch" value={formatINR(wallet.pendingProviderSettlement)} detail="Paid online, releases within 24 hours" icon={ReceiptText} tone="purple" />
        <MetricCard title="Pending payments" value={formatINR(data.metrics.pendingPaymentsAmount)} detail={`${data.metrics.pendingPaymentsCount} reminders due`} icon={CreditCard} tone="amber" />
      </div>
      <Card className="mt-5 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-mist text-xs uppercase text-slate-500">
              <tr>{[copy.transactionSingular, copy.customerSingular, "Amount", "Provider", "Payment ID", "Wallet", "Fee", "Payment", "Invoice", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paymentPagination.pageItems.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-4 font-bold text-ink">{payment.orderNumber}</td>
                  <td className="px-4 py-4 text-slate-600">{payment.customer}</td>
                  <td className="px-4 py-4 font-bold">{formatINR(payment.amount)}</td>
                  <td className="px-4 py-4">{payment.provider}</td>
                  <td className="px-4 py-4 text-slate-500">{payment.paymentId}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink">{payment.walletStatus}</p>
                    {payment.walletAmount > 0 && <p className="mt-1 text-xs text-slate-500">{formatINR(payment.walletAmount)}</p>}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{payment.platformFee > 0 ? formatINR(payment.platformFee) : "-"}</td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[124px] items-center gap-2">
                      <PaymentStatusAnimation status={payment.status} provider={payment.provider} label={`${payment.status.toLowerCase()} payment`} className="size-8" />
                      <div className="min-w-0">
                        <StatusPill status={payment.status} className="px-2 py-0.5 text-[11px]" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="font-bold text-ocean">Open</a></td>
                  <td className="px-4 py-4">
                    {payment.canMarkPaid ? (
                      <Button size="sm" variant="emerald" disabled={collectingPaymentId === payment.id} onClick={() => markPaymentCollected(payment.id, payment.orderNumber)}>
                        {collectingPaymentId === payment.id ? "Saving" : "Mark Paid"}
                      </Button>
                    ) : payment.refundStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={paymentPagination.page}
          pageCount={paymentPagination.pageCount}
          totalItems={paymentPagination.totalItems}
          startItem={paymentPagination.startItem}
          endItem={paymentPagination.endItem}
          itemLabel="payments"
          onPageChange={paymentPagination.setPage}
        />
      </Card>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function invoiceStatusLabel(status: string) {
  return formatPlanName(status);
}

function isPaidInvoiceStatus(status: string) {
  return status === "COMPLETED" || status === "ACTIVE";
}

function isPendingInvoiceStatus(status: string) {
  return status === "PENDING" || status === "PAST_DUE" || status === "TRIAL";
}

function mapCustomerInvoiceRow(invoice: LivePayment, customerLabel: string): InvoiceTableRow {
  return {
    id: invoice.id,
    kind: "customer",
    reference: invoice.orderNumber,
    subReference: invoice.paymentId,
    party: invoice.customer,
    partyDetail: customerLabel,
    issuedAt: invoice.createdAt,
    amount: invoice.amount,
    provider: invoice.provider,
    paymentLabel: invoice.linkStatus,
    status: invoice.status,
    statusLabel: invoiceStatusLabel(invoice.status),
    invoiceUrl: invoice.invoiceUrl
  };
}

function mapBusinessInvoiceRow(invoice: LiveBillingHistoryItem, businessName: string): InvoiceTableRow {
  return {
    id: invoice.id,
    kind: "business",
    reference: invoice.reference,
    subReference: invoice.label,
    party: businessName || "Business account",
    partyDetail: `${formatDateLabel(invoice.periodStart)} to ${formatDateLabel(invoice.periodEnd)}`,
    issuedAt: invoice.issuedAt,
    amount: invoice.amount,
    provider: invoice.provider,
    paymentLabel: "Subscription cycle",
    status: invoice.status,
    statusLabel: invoiceStatusLabel(invoice.status),
    invoiceUrl: invoice.invoiceUrl
  };
}

export function InvoicesPage() {
  const { data, connected, error, loading } = useDashboardLive();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("customer");
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const customerInvoiceRows = useMemo(
    () => data.payments.map((invoice) => mapCustomerInvoiceRow(invoice, copy.customerSingular)),
    [copy.customerSingular, data.payments]
  );
  const businessInvoiceRows = useMemo(
    () => data.billing.history.map((invoice) => mapBusinessInvoiceRow(invoice, data.business.name)),
    [data.billing.history, data.business.name]
  );
  const invoiceRows = invoiceMode === "customer" ? customerInvoiceRows : businessInvoiceRows;
  const paidInvoiceRows = invoiceRows.filter((invoice) => isPaidInvoiceStatus(invoice.status));
  const pendingInvoiceRows = invoiceRows.filter((invoice) => isPendingInvoiceStatus(invoice.status));
  const failedInvoiceRows = invoiceRows.filter((invoice) => invoice.status === "FAILED");
  const totalInvoiced = invoiceRows.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidAmount = paidInvoiceRows.reduce((sum, invoice) => sum + invoice.amount, 0);
  const modeCopy = invoiceMode === "customer"
    ? {
        title: "Customer invoices",
        eyebrow: "Customer payment records",
        description: `Payment-linked invoices from ${copy.transactionPlural.toLowerCase()} placed by ${copy.customerPlural.toLowerCase()}.`,
        totalDetail: `${copy.transactionPlural} with invoice rows`,
        paidDetail: `${paidInvoiceRows.length} paid`,
        attentionDetail: `${pendingInvoiceRows.length} pending, ${failedInvoiceRows.length} failed`,
        ownerHeading: copy.customerSingular,
        paymentHeading: "Payment",
        empty: "No customer invoices are available yet.",
        exportName: "customer-invoices",
        itemLabel: "customer invoices"
      }
    : {
        title: "Business-owned invoices",
        eyebrow: "Subscription billing records",
        description: "Subscription, renewal, and platform billing invoices owned by this business account.",
        totalDetail: "Subscription invoice rows",
        paidDetail: `${paidInvoiceRows.length} paid or active`,
        attentionDetail: `${pendingInvoiceRows.length} pending, ${failedInvoiceRows.length} failed`,
        ownerHeading: "Business",
        paymentHeading: "Billing",
        empty: "No business-owned invoices are available yet.",
        exportName: "business-owned-invoices",
        itemLabel: "business invoices"
      };
  const invoicePagination = usePaginatedItems(invoiceRows, {
    resetKey: `${invoiceMode}-${invoiceRows.length}-${invoiceRows[0]?.id ?? "empty"}-${invoiceRows.at(-1)?.id ?? "empty"}`
  });
  const invoiceModeOptions = [
    {
      mode: "customer" as const,
      label: "Customer invoices",
      detail: `${customerInvoiceRows.length} rows`,
      icon: UsersRound
    },
    {
      mode: "business" as const,
      label: "Business-owned",
      detail: `${businessInvoiceRows.length} rows`,
      icon: Building2
    }
  ];

  if (loading) return <DashboardPageSkeleton variant="table" />;

  function exportInvoices() {
    downloadCsv(
      `vyapaarmate-${modeCopy.exportName}-${dateStamp()}.csv`,
      invoiceRows.map((invoice) => ({
        invoice: invoice.reference,
        owner: invoice.party,
        amount: invoice.amount,
        status: invoice.statusLabel,
        provider: invoice.provider,
        payment: invoice.paymentLabel,
        issuedAt: invoice.issuedAt,
        invoiceUrl: invoice.invoiceUrl
      }))
    );
    setNotice({ tone: "success", message: `${invoiceRows.length} ${modeCopy.itemLabel} exported to CSV.` });
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        body={`Switch between customer payment invoices and business-owned subscription invoices with printable links.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button variant="secondary" icon={<ArrowDownToLine className="size-4" />} onClick={exportInvoices}>
              Export CSV
            </Button>
          </div>
        }
      />
      <Card className="invoice-source-panel mt-5 overflow-hidden p-0">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-ocean">{modeCopy.eyebrow}</p>
            <h2 className="mt-2 text-xl font-bold text-ink">{modeCopy.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{modeCopy.description}</p>
          </div>
          <div className="invoice-mode-switch relative grid min-h-[4.5rem] grid-cols-2 rounded-lg border border-line bg-white/80 p-1 shadow-inner">
            <span
              aria-hidden="true"
              className={cn(
                "invoice-mode-indicator absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md transition duration-500 ease-out",
                invoiceMode === "business" ? "translate-x-[calc(100%+0.25rem)] bg-ink" : "translate-x-0 bg-ocean"
              )}
            />
            {invoiceModeOptions.map((option) => {
              const active = option.mode === invoiceMode;
              const Icon = option.icon;
              return (
                <button
                  key={option.mode}
                  type="button"
                  aria-pressed={active}
                  data-active={active}
                  className={cn(
                    "relative z-10 flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition duration-300",
                    active ? "text-white" : "text-slate-600 hover:text-ink"
                  )}
                  onClick={() => setInvoiceMode(option.mode)}
                >
                  <span className={cn("invoice-mode-icon grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-white/15 text-white" : "bg-mist text-ocean")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{option.label}</span>
                    <span className={cn("mt-0.5 block text-xs font-semibold", active ? "text-white/75" : "text-slate-500")}>{option.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      <div key={invoiceMode} className="invoice-view-panel mt-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total invoices" value={String(invoiceRows.length)} detail={modeCopy.totalDetail} icon={ReceiptText} tone="blue" />
          <MetricCard title="Total invoiced" value={formatINR(totalInvoiced)} detail="All visible invoice rows" icon={IndianRupee} tone="purple" />
          <MetricCard title="Paid invoices" value={formatINR(paidAmount)} detail={modeCopy.paidDetail} icon={CheckCircle2} tone="emerald" />
          <MetricCard title="Attention needed" value={String(pendingInvoiceRows.length + failedInvoiceRows.length)} detail={modeCopy.attentionDetail} icon={FileCheck2} tone="amber" />
        </div>
        <Card className="mt-5 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-mist text-xs uppercase text-slate-500">
                <tr>{["Invoice", modeCopy.ownerHeading, "Issued", "Amount", "Provider", modeCopy.paymentHeading, "Status", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoicePagination.pageItems.map((invoice, index) => (
                  <tr
                    key={invoice.id}
                    className="invoice-table-row transition hover:bg-mist/70"
                    style={{ animationDelay: `${Math.min(index, 8) * 34}ms` }}
                  >
                    <td className="px-4 py-4">
                      <p className="font-bold text-ink">{invoice.reference}</p>
                      <p className="mt-1 text-xs text-slate-500">{invoice.subReference}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-700">{invoice.party}</p>
                      <p className="mt-1 text-xs text-slate-500">{invoice.partyDetail}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDateLabel(invoice.issuedAt)}</td>
                    <td className="px-4 py-4 font-bold text-ink">{formatINR(invoice.amount)}</td>
                    <td className="px-4 py-4 text-slate-600">{invoice.provider}</td>
                    <td className="px-4 py-4 text-slate-600">{invoice.paymentLabel}</td>
                    <td className="px-4 py-4">
                      {invoice.kind === "customer" ? (
                        <div className="flex items-center gap-2">
                          <PaymentStatusAnimation status={invoice.status as LivePaymentStatus} label={`${invoice.statusLabel.toLowerCase()} payment`} className="size-8" />
                          <StatusPill status={invoice.status} label={invoice.statusLabel} />
                        </div>
                      ) : (
                        <StatusPill status={invoice.status} label={invoice.statusLabel} />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-ocean transition hover:-translate-y-0.5 hover:border-ocean/40 hover:shadow-sm">
                        Open
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={invoicePagination.page}
            pageCount={invoicePagination.pageCount}
            totalItems={invoicePagination.totalItems}
            startItem={invoicePagination.startItem}
            endItem={invoicePagination.endItem}
            itemLabel={modeCopy.itemLabel}
            onPageChange={invoicePagination.setPage}
          />
          {invoiceRows.length === 0 && (
            <div className="border-t border-line p-4 text-sm text-slate-500">{modeCopy.empty}</div>
          )}
        </Card>
      </div>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function CampaignsPage() {
  const [campaignDialog, setCampaignDialog] = useState<{ title: string; body: string } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const newCampaignIdRef = useRef(0);
  const campaignPagination = usePaginatedItems(campaigns, {
    resetKey: `${campaigns.length}-${campaigns[0]?.id ?? "empty"}-${campaigns.at(-1)?.id ?? "empty"}`
  });

  function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const campaign: Campaign = {
      id: `campaign_local_${++newCampaignIdRef.current}`,
      title: formString(formData, "title", "New campaign"),
      body: formString(formData, "body", "Campaign message"),
      audience: formString(formData, "audience", "Marketing opted-in customers"),
      status: "Draft"
    };

    setCampaigns((current) => [campaign, ...current]);
    setCampaignDialog(null);
    setNotice({ tone: "success", message: `${campaign.title} campaign created.` });
  }

  return (
    <>
      <PageHeader
        title="WhatsApp Campaigns"
        body="Status updates are transactional. Marketing campaigns only target customers who opted in to offers."
        action={
          <Button variant="emerald" icon={<Megaphone className="size-4" />} onClick={() => setCampaignDialog({ title: "", body: "" })}>
            Create Campaign
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {campaignTemplates.map(([title, body]) => (
          <Card key={title}>
            <MessageCircle className="size-7 text-emerald" />
            <h2 className="mt-4 font-bold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            <Button className="mt-5 w-full" variant="secondary" onClick={() => setCampaignDialog({ title, body })}>
              Use Template
            </Button>
          </Card>
        ))}
      </div>
      {campaigns.length > 0 && (
        <Card className="mt-5">
          <h2 className="font-bold text-ink">Created campaigns</h2>
          <div className="mt-4 grid gap-3">
            {campaignPagination.pageItems.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist p-3">
                <div>
                  <p className="font-semibold text-ink">{campaign.title}</p>
                  <p className="text-xs text-slate-500">{campaign.audience}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={campaign.status} />
                  <button
                    type="button"
                    aria-label={`Delete ${campaign.title}`}
                    className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                    onClick={() => setDeleteTarget({ type: "campaign", campaign })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            className="mt-4 rounded-lg border border-line bg-white"
            page={campaignPagination.page}
            pageCount={campaignPagination.pageCount}
            totalItems={campaignPagination.totalItems}
            startItem={campaignPagination.startItem}
            endItem={campaignPagination.endItem}
            itemLabel="campaigns"
            onPageChange={campaignPagination.setPage}
          />
        </Card>
      )}
      {campaignDialog && (
        <ActionDialog title="Create campaign" body="Prepare the campaign before sending it to opted-in customers." onClose={() => setCampaignDialog(null)}>
          <form className="grid gap-4" onSubmit={submitCampaign}>
            <div className="grid gap-2">
              <Label>Campaign name</Label>
              <Input name="title" required autoFocus defaultValue={campaignDialog.title} />
            </div>
            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea name="body" required defaultValue={campaignDialog.body} />
            </div>
            <div className="grid gap-2">
              <Label>Audience</Label>
              <select name="audience" className={selectClassName} defaultValue="Marketing opted-in customers">
                <option>Marketing opted-in customers</option>
                <option>Repeat customers</option>
                <option>Pending payment customers</option>
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setCampaignDialog(null)}>Cancel</Button>
              <Button type="submit" variant="emerald">Create Campaign</Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {deleteTarget?.type === "campaign" && (
        <ActionDialog
          title="Delete campaign"
          body={`${deleteTarget.campaign.title} will be removed from draft campaigns.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                setCampaigns((current) => current.filter((campaign) => campaign.id !== deleteTarget.campaign.id));
                setNotice({ tone: "success", message: `${deleteTarget.campaign.title} deleted.` });
                setDeleteTarget(null);
              }}
            >
              Delete Campaign
            </Button>
          </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function StaffPage() {
  const { data, loading: liveLoading } = useDashboardLive();
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const StaffIcon = icons.staffIcon;
  const kitchenRoleLabel = roleLabel("KITCHEN_STAFF", data.business.businessType);
  const serviceRoleLabel = roleLabel("DELIVERY_STAFF", data.business.businessType);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<StaffMember | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const staffLoadedRef = useRef(false);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const response = await fetch("/api/dashboard/staff", { cache: "no-store" });
      if (!response.ok) throw new Error(`Staff load failed with ${response.status}`);

      const payload = (await response.json()) as { staff: StaffMember[] };
      setStaff(payload.staff);
    } catch {
      setStaff([]);
    } finally {
      staffLoadedRef.current = true;
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStaff();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStaff]);

  useEffect(() => {
    if (staffLoadedRef.current) void loadStaff();
  }, [data.syncedAt, loadStaff]);

  const staffPagination = usePaginatedItems(staff, {
    resetKey: `${staff.length}-${staff[0]?.id ?? "empty"}-${staff.at(-1)?.id ?? "empty"}`
  });

  if (liveLoading || staffLoading) return <DashboardPageSkeleton variant="cards" />;

  async function submitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formString(formData, "name", "New staff");
    const email = formString(formData, "email");
    const phone = formString(formData, "phone");
    const roleValue = formString(formData, "role", "KITCHEN_STAFF");
    const role = roleLabel(roleValue, data.business.businessType);

    const response = await fetch("/api/dashboard/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, role: roleValue })
    });

    if (!response.ok) {
      setNotice({ tone: "error", message: `Could not invite ${name}. Check the email and phone.` });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { invite?: StaffInviteState };
    await loadStaff();
    setDialogOpen(false);
    setNotice({ tone: payload.invite?.status === "failed" ? "error" : "success", message: staffInviteNotice(name, role, payload.invite) });
  }

  async function updateStaffRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roleTarget) return;

    const formData = new FormData(event.currentTarget);
    const roleValue = formString(formData, "role", roleTarget.roleValue ?? "KITCHEN_STAFF");
    const role = roleLabel(roleValue, data.business.businessType);

    const response = await fetch(`/api/dashboard/staff/${encodeURIComponent(roleTarget.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleValue })
    });

    if (!response.ok) {
      setNotice({ tone: "error", message: `Could not change ${roleTarget.name}'s role.` });
      return;
    }

    await loadStaff();
    setRoleTarget(null);
    setNotice({ tone: "success", message: `${roleTarget.name} is now ${role}.` });
  }

  async function resendStaffInvite(member: StaffMember) {
    setResendingInviteId(member.id);
    try {
      const response = await fetch(`/api/dashboard/staff/${encodeURIComponent(member.id)}`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { invite?: StaffInviteState; error?: string };
      if (!response.ok) {
        setNotice({ tone: "error", message: payload.error ?? `Could not resend invite to ${member.name}.` });
        return;
      }

      if (payload.invite?.status === "placeholder" && payload.invite.devInviteUrl) {
        setNotice({ tone: "success", message: `Invite ready for ${member.name}. Local invite link: ${payload.invite.devInviteUrl}` });
      } else {
        setNotice({ tone: "success", message: `Invite sent to ${member.name}.` });
      }
    } finally {
      setResendingInviteId(null);
    }
  }

  async function deleteStaff(member: StaffMember) {
    setDeleteTarget(null);

    const response = await fetch(`/api/dashboard/staff/${encodeURIComponent(member.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice({ tone: "error", message: `Could not delete ${member.name}.` });
      return;
    }

    await loadStaff();
    setNotice({ tone: "success", message: `${member.name} deleted from staff.` });
  }

  return (
    <>
      <PageHeader
        title="Staff"
        body="Invite staff users and apply business access by role."
        action={
          <Button variant="emerald" icon={<StaffIcon className="size-4" />} onClick={() => setDialogOpen(true)}>
            Add Staff
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {staffPagination.pageItems.map((member) => {
          const editable = member.role !== "Owner" && member.roleValue !== "OWNER";

          return (
            <Card key={member.id}>
              <div className="flex items-start justify-between gap-3">
                <StaffIcon className="size-7 text-ocean" />
                {editable && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Resend invite to ${member.name}`}
                      title="Resend invite"
                      disabled={resendingInviteId === member.id}
                      className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => resendStaffInvite(member)}
                    >
                      {resendingInviteId === member.id ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    </button>
                    <button
                      type="button"
                      aria-label={`Change role for ${member.name}`}
                      title="Change role"
                      className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                      onClick={() => setRoleTarget(member)}
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${member.name}`}
                      title="Delete staff"
                      className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100"
                      onClick={() => setDeleteTarget({ type: "staff", member })}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              <h2 className="mt-4 font-bold text-ink">{member.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{roleLabel(member.roleValue ?? member.role, data.business.businessType)}</p>
              {member.email && <p className="mt-1 break-all text-xs text-slate-500">{member.email}</p>}
              <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{member.permissions}</p>
              <StatusPill status={member.status} />
            </Card>
          );
        })}
        {staff.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">No staff users loaded.</p>
          </Card>
        )}
      </div>
      <PaginationControls
        className="mt-4 rounded-lg border border-line bg-white"
        page={staffPagination.page}
        pageCount={staffPagination.pageCount}
        totalItems={staffPagination.totalItems}
        startItem={staffPagination.startItem}
        endItem={staffPagination.endItem}
        itemLabel="staff"
        onPageChange={staffPagination.setPage}
      />
      {dialogOpen && (
        <ActionDialog title="Add staff" body="Invite a staff member and choose their dashboard role." onClose={() => setDialogOpen(false)}>
          <form className="grid gap-4" onSubmit={submitStaff}>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input name="name" required autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <PhoneInput name="phone" />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <select name="role" className={selectClassName} defaultValue="KITCHEN_STAFF">
                <option value="MANAGER">Manager</option>
                <option value="KITCHEN_STAFF">{kitchenRoleLabel}</option>
                <option value="DELIVERY_STAFF">{serviceRoleLabel}</option>
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="emerald">Invite Staff</Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {roleTarget && (
        <ActionDialog title="Change role" body={`Update dashboard access for ${roleTarget.name}.`} onClose={() => setRoleTarget(null)}>
          <form className="grid gap-4" onSubmit={updateStaffRole}>
            <div className="grid gap-2">
              <Label>Role</Label>
              <select name="role" className={selectClassName} defaultValue={roleTarget.roleValue ?? "KITCHEN_STAFF"}>
                <option value="MANAGER">Manager</option>
                <option value="KITCHEN_STAFF">{kitchenRoleLabel}</option>
                <option value="DELIVERY_STAFF">{serviceRoleLabel}</option>
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setRoleTarget(null)}>Cancel</Button>
              <Button type="submit" variant="emerald" icon={<RefreshCw className="size-4" />}>Update Role</Button>
            </div>
          </form>
        </ActionDialog>
      )}
      {deleteTarget?.type === "staff" && (
        <ActionDialog
          title="Delete staff"
          body={`${deleteTarget.member.name} will lose access to this business dashboard.`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleteStaff(deleteTarget.member)}>
              Delete Staff
            </Button>
          </div>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function ReportsPage() {
  const { data, connected, error, loading } = useDashboardLive();
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const icons = getBusinessConsoleIcons(data.business.businessType);
  const TransactionIcon = icons.transactionIcon;
  const CustomerIcon = icons.customerIcon;
  const ItemIcon = icons.itemIcon;
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const reports = data.reports;
  const maxRevenue = Math.max(1, ...reports.monthlyTrend.map((point) => point.revenue));

  if (loading) return <DashboardPageSkeleton variant="reports" />;

  function exportReports() {
    downloadCsv(
      `vyapaarmate-reports-${dateStamp()}.csv`,
      reports.monthlyTrend.map((point) => ({
        month: point.label,
        revenue: point.revenue,
        orders: point.orders
      }))
    );
    setNotice({ tone: "success", message: `${reports.monthlyTrend.length} report rows exported to CSV.` });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        body={`Daily, weekly, monthly sales, ${copy.topItemsTitle.toLowerCase()}, ${copy.customerPlural.toLowerCase()} retention, repeat ${copy.transactionSingular.toLowerCase()} rate, and average ${copy.transactionSingular.toLowerCase()} value.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
            <Button variant="secondary" icon={<ArrowDownToLine className="size-4" />} onClick={exportReports}>
              Export CSV
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Daily sales" value={formatINR(reports.dailySales)} detail={`${reports.dailyOrders} ${copy.transactionPlural.toLowerCase()} today`} icon={BarChart3} tone="blue" />
        <MetricCard title="Weekly sales" value={formatINR(reports.weeklySales)} detail={`${formatSignedPercent(reports.weeklyChangePercent)} week over week`} icon={TrendingUp} tone="emerald" />
        <MetricCard title={`Repeat ${copy.transactionSingular.toLowerCase()} rate`} value={`${reports.repeatOrderRate}%`} detail={`${reports.repeatCustomers} of ${reports.totalCustomers} ${copy.customerPlural.toLowerCase()}`} icon={CustomerIcon} tone="purple" />
        <MetricCard title={`Average ${copy.transactionSingular.toLowerCase()} value`} value={formatINR(reports.averageOrderValue)} detail={`${reports.completedPayments} paid ${copy.transactionPlural.toLowerCase()} this month`} icon={TransactionIcon} tone="amber" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink sm:text-lg">Monthly sales</h2>
            <Badge variant="blue" className="shrink-0">{formatINR(reports.monthlySales)}</Badge>
          </div>
          <div className="mt-5 grid h-64 grid-cols-12 items-end gap-2 sm:mt-6 sm:gap-3">
            {reports.monthlyTrend.map((point) => (
              <div key={point.label} className="flex min-w-0 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-ocean to-emerald sm:rounded-t-lg"
                  title={`${point.label}: ${formatINR(point.revenue)} from ${point.orders} orders`}
                  style={{ height: `${trendBarHeight(point.revenue, maxRevenue)}px` }}
                />
                <span className="max-w-full truncate text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">{point.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ItemIcon className="size-5 text-ocean" />
            {copy.topItemsTitle} revenue
          </h2>
          <div className="mt-4 grid gap-3">
            {data.topItems.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-white text-sm font-bold text-ocean">{index + 1}</span>
                  <div>
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.quantitySold} {copy.transactionPlural.toLowerCase()}</p>
                  </div>
                </div>
                <p className="font-bold text-emerald">{formatINR(item.revenue)}</p>
              </div>
            ))}
            {data.topItems.length === 0 && (
              <p className="rounded-lg bg-mist p-3 text-sm text-slate-500">No paid {copy.itemSingular.toLowerCase()} data yet.</p>
            )}
          </div>
        </Card>
      </div>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
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

export function BillingPage() {
  const router = useRouter();
  const { data, connected, error, loading, refresh } = useDashboardLive();
  const billing = data.billing;
  const kyc = data.kyc;
  const currentPlan = pricingPlans.find((plan) => plan.id === billing.plan) ?? pricingPlans[0];
  const primaryCheckoutPlan: SubscriptionPlanId = billing.status === "ACTIVE" ? "PRO" : billing.plan;
  const primaryCheckoutPlanDetails = pricingPlans.find((plan) => plan.id === primaryCheckoutPlan) ?? currentPlan;
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [uploadingKycType, setUploadingKycType] = useState<string | null>(null);
  const [kycUploadFeedback, setKycUploadFeedback] = useState<KycUploadFeedback | null>(null);
  const isPro = billing.plan === "PRO" && billing.status === "ACTIVE";
  const paymentRequired = billing.status !== "ACTIVE";
  const billingHistoryPagination = usePaginatedItems(billing.history, {
    resetKey: `${billing.history.length}-${billing.history[0]?.id ?? "empty"}-${billing.history.at(-1)?.id ?? "empty"}`
  });

  if (loading) return <DashboardPageSkeleton variant="billing" />;

  function goToSubscriptionCheckout(plan: SubscriptionPlanId) {
    router.push(`/dashboard/billing/checkout?plan=${encodeURIComponent(plan)}`);
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
        title="Subscription/Billing"
        body="Current plan, setup fee, invoices, subscription state, and payment history."
        action={<LiveSyncStatus connected={connected} source={data.source} error={error} />}
      />
      {paymentRequired && (
        <Card className="mb-5 border border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge variant="amber">Payment required</Badge>
              <h2 className="mt-3 text-xl font-bold text-ink">Pay {formatPlanName(billing.plan)} to continue KYC</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Your business stays hidden from customers until subscription payment, KYC document upload, and PSHR admin approval are complete.
              </p>
            </div>
            <Button variant="emerald" icon={<ReceiptText className="size-4" />} onClick={() => goToSubscriptionCheckout(billing.plan)}>
              Review billing
            </Button>
          </div>
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassPanel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple">{formatPlanName(billing.plan)} plan</Badge>
            <StatusPill status={billing.status} />
          </div>
          <h2 className="mt-4 text-3xl font-bold text-ink">{formatINR(billing.monthlyAmount)}/month</h2>
          <p className="mt-3 leading-7 text-slate-600">
            {currentPlan.description} Current subscription for {data.business.name}.
          </p>
          <Button
            className="mt-6"
            variant="emerald"
            icon={<ReceiptText className="size-4" />}
            onClick={() => goToSubscriptionCheckout(primaryCheckoutPlan)}
          >
            {billing.status !== "ACTIVE"
              ? `Review ${primaryCheckoutPlanDetails.name}`
              : isPro
                ? "Renew Pro"
                : "Upgrade to Pro"}
          </Button>
        </GlassPanel>
        <Card>
          <h2 className="font-bold text-ink">Subscription cycle</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Period start</p>
              <p className="mt-2 font-bold text-ink">{formatDateLabel(billing.currentPeriodStart)}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Next renewal</p>
              <p className="mt-2 font-bold text-ink">{formatDateLabel(billing.nextRenewalDate)}</p>
            </div>
            <div className="rounded-lg bg-mist p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Setup fee</p>
              <p className="mt-2 font-bold text-ink">{billing.setupFeeAmount === null ? "Not set" : formatINR(billing.setupFeeAmount)}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600">
            Current billing period ends on <span className="font-bold text-ink">{formatDateLabel(billing.currentPeriodEnd)}</span>.
          </div>
        </Card>
      </div>
      <Card className="mt-5 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={kyc.status === "APPROVED" ? "emerald" : kyc.status === "REJECTED" ? "red" : kyc.status === "UNDER_REVIEW" ? "purple" : "amber"}>
                {kyc.label}
              </Badge>
              <Badge variant="blue">{kyc.uploadedDocumentCount}/{kyc.requiredDocumentCount} documents</Badge>
            </div>
            <h2 className="mt-3 text-xl font-bold text-ink">Business KYC documents</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {billing.status !== "ACTIVE"
                ? "Complete subscription payment to unlock document upload."
                : kyc.readyForReview
                  ? "All required documents are uploaded and waiting for PSHR admin approval."
                  : kyc.status === "APPROVED"
                    ? "KYC is approved. Your business can be shown publicly while active."
                    : "Upload every required document for PSHR admin review."}
            </p>
          </div>
          {kyc.status === "UNDER_REVIEW" && <Badge variant="purple">Admin review</Badge>}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {kyc.requiredDocuments.map((requirement) => {
            const document = kyc.documents.find((candidate) => candidate.type === requirement.type);
            const uploading = uploadingKycType === requirement.type;
            const disabled = !kyc.canUpload || uploadingKycType !== null;

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
                      : "cursor-pointer bg-ink text-white hover:bg-ocean"
                  }`}
                >
                  {uploading ? <LoaderCircle className="size-4 shrink-0 animate-spin" /> : <UploadCloud className="size-4 shrink-0" />}
                  <span className="min-w-0 truncate">{uploading ? "Uploading" : document ? "Replace Document" : "Upload Document"}</span>
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
      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">Choose a subscription plan</h2>
            <p className="mt-1 text-sm text-slate-600">Start a plan here, then review billing details and apply coupons on the next page.</p>
          </div>
          <Badge variant="blue">Next: billing details</Badge>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {pricingPlans.map((plan) => {
            const planKey = plan.id;
            const active = billing.plan === planKey && billing.status === "ACTIVE";
            return (
              <div key={plan.name} className={cn("flex h-full flex-col rounded-lg border bg-mist p-4", active ? "border-emerald shadow-soft" : "border-line")}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                  {active && <Badge variant="emerald">Active</Badge>}
                </div>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
                <p className="mt-4 text-3xl font-extrabold text-ink">{formatINR(plan.price)}<span className="text-sm font-medium text-slate-500">/month</span></p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={plan.name === "Pro" ? "emerald" : "primary"}
                  onClick={() => goToSubscriptionCheckout(planKey)}
                >
                  {active ? `Renew ${plan.name}` : `Start ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">Billing history</h2>
          <Badge variant={billingStatusVariant(billing.status)}>{billing.history.length} rows</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {billingHistoryPagination.pageItems.map((invoice) => (
            <div key={invoice.id} className="grid gap-3 rounded-lg bg-mist p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <div>
                <p className="font-semibold text-ink">{invoice.label}</p>
                <p className="text-xs text-slate-500">
                  {invoice.reference} · {formatDateLabel(invoice.periodStart)} to {formatDateLabel(invoice.periodEnd)}
                </p>
              </div>
              <p className="font-bold text-ink">{formatINR(invoice.amount)}</p>
              <StatusPill status={invoice.status} />
              <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-ocean">Invoice</a>
            </div>
          ))}
          {billing.history.length === 0 && (
            <p className="rounded-lg bg-mist p-3 text-sm text-slate-500">No subscription invoice rows are available yet.</p>
          )}
        </div>
        <PaginationControls
          className="mt-4 rounded-lg border border-line bg-white"
          page={billingHistoryPagination.page}
          pageCount={billingHistoryPagination.pageCount}
          totalItems={billingHistoryPagination.totalItems}
          startItem={billingHistoryPagination.startItem}
          endItem={billingHistoryPagination.endItem}
          itemLabel="billing rows"
          onPageChange={billingHistoryPagination.setPage}
        />
      </Card>
      <KycUploadFeedbackDialog feedback={kycUploadFeedback} onClose={() => setKycUploadFeedback(null)} />
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

type SettingsSectionId = "business-profile" | "whatsapp-api" | "wallet-payout" | "payment-rules";
type SettingsSectionAccent = "ocean" | "emerald" | "violet";

const settingsSectionAccentClasses: Record<
  SettingsSectionAccent,
  {
    arrowOpen: string;
    arrowHover: string;
    icon: string;
    iconShell: string;
    signal: string;
    line: string;
  }
> = {
  ocean: {
    arrowOpen: "border-ocean/25 bg-ocean text-white shadow-[0_10px_28px_rgba(18,70,160,0.26)]",
    arrowHover: "group-hover:border-ocean/25 group-hover:bg-ocean group-hover:text-white",
    icon: "text-ocean",
    iconShell: "border-ocean/15 bg-ocean/10",
    signal: "bg-ocean",
    line: "from-ocean/70 via-violet/60 to-transparent"
  },
  emerald: {
    arrowOpen: "border-emerald/25 bg-emerald text-white shadow-[0_10px_28px_rgba(17,166,106,0.26)]",
    arrowHover: "group-hover:border-emerald/25 group-hover:bg-emerald group-hover:text-white",
    icon: "text-emerald",
    iconShell: "border-emerald/15 bg-emerald/10",
    signal: "bg-emerald",
    line: "from-emerald/70 via-ocean/55 to-transparent"
  },
  violet: {
    arrowOpen: "border-violet/25 bg-violet text-white shadow-[0_10px_28px_rgba(108,61,244,0.24)]",
    arrowHover: "group-hover:border-violet/25 group-hover:bg-violet group-hover:text-white",
    icon: "text-violet",
    iconShell: "border-violet/15 bg-violet/10",
    signal: "bg-violet",
    line: "from-violet/70 via-ocean/55 to-transparent"
  }
};

function SettingsAccordionSection({
  sectionId,
  title,
  description,
  icon,
  badge,
  accent = "ocean",
  open,
  onToggle,
  saveLabel,
  saving,
  children
}: {
  sectionId: SettingsSectionId;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: ReactNode;
  accent?: SettingsSectionAccent;
  open: boolean;
  onToggle: (sectionId: SettingsSectionId) => void;
  saveLabel: string;
  saving: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const accentClasses = settingsSectionAccentClasses[accent];

  return (
    <Card
      data-open={open ? "true" : "false"}
      data-settings-section-id={sectionId}
      className="settings-accordion-card group relative scroll-mt-28 self-start overflow-hidden border-ocean/10 bg-white/95 p-0 shadow-[0_18px_55px_rgba(18,70,160,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-ocean/20 hover:shadow-[0_22px_70px_rgba(18,70,160,0.12)] data-[open=true]:border-ocean/25 data-[open=true]:shadow-[0_24px_80px_rgba(18,70,160,0.15)]"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="relative z-10 flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-ocean/10"
        onClick={() => onToggle(sectionId)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-lg border", accentClasses.iconShell)}>
            <span className={cn("absolute right-2 top-2 size-1.5 rounded-full shadow-[0_0_14px_currentColor] motion-safe:animate-pulse", accentClasses.signal)} />
            <span className={accentClasses.icon}>{icon}</span>
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold leading-6 text-ink">{title}</span>
              {badge}
            </span>
            <span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className={cn("hidden h-px w-12 bg-gradient-to-r sm:block", accentClasses.line)} />
          <span
            aria-hidden="true"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-slate-600 shadow-sm transition duration-300",
              accentClasses.arrowHover,
              open && accentClasses.arrowOpen
            )}
          >
            <ChevronDown className={cn("size-5 stroke-[2.5] transition-transform duration-300", open && "rotate-180")} />
          </span>
        </span>
      </button>
      <div
        id={panelId}
        aria-hidden={!open}
        inert={open ? undefined : true}
        className={cn(
          "relative z-10 grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "grid gap-4 border-t border-line/70 px-5 pb-5 pt-4",
              open && "motion-safe:animate-[settings-section-rise_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
            )}
          >
            {children}
            <div className="flex justify-end border-t border-line/70 pt-4">
              <Button
                type="submit"
                variant="emerald"
                disabled={saving}
                className="w-full sm:w-auto"
                icon={saving ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              >
                {saving ? "Saving" : saveLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const { data, connected, error, loading, refresh } = useDashboardLive();
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [saving, setSaving] = useState(false);
  const business = data.business;
  const [selectedBusinessType, setSelectedBusinessType] = useState("");
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<PayoutMethod | null>(null);
  const [pendingLogoImageDataUrl, setPendingLogoImageDataUrl] = useState<string | null | undefined>(undefined);
  const [openSettingsSection, setOpenSettingsSection] = useState<SettingsSectionId | null>("business-profile");
  const [businessAddressDraft, setBusinessAddressDraft] = useState<string | null>(null);
  const settingsPageRenderedRef = useRef(false);
  const handleBusinessImageError = useCallback((message: string) => {
    setNotice({ tone: "error", message });
  }, []);
  const payoutMethod = selectedPayoutMethod ?? business.payoutMethod ?? "UPI";
  const businessAddressValue = businessAddressDraft ?? business.address;

  useEffect(() => {
    if (loading) return;
    if (!settingsPageRenderedRef.current) {
      settingsPageRenderedRef.current = true;
      return;
    }
    if (!openSettingsSection) return;

    const animationFrame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-settings-section-id="${openSettingsSection}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [loading, openSettingsSection]);

  if (loading) return <DashboardPageSkeleton variant="settings" />;

  const activeBusinessType = selectedBusinessType || business.businessType;
  const copy = getBusinessConsoleCopy(activeBusinessType);
  const icons = getBusinessConsoleIcons(activeBusinessType);
  const BusinessIcon = icons.businessIcon;
  const TransactionIcon = icons.transactionIcon;
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
  const isSettingsSectionOpen = (sectionId: SettingsSectionId) => openSettingsSection === sectionId;

  function toggleSettingsSection(sectionId: SettingsSectionId) {
    setOpenSettingsSection((currentSection) => (currentSection === sectionId ? null : sectionId));
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      businessHours: formString(formData, "businessHours", business.hours),
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
      const response = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setNotice({
          tone: "error",
          message: await readActionError(response, "Could not save settings. Check the open, radius, and fulfillment values.")
        });
        return;
      }

      await refresh();
      setBusinessAddressDraft(null);
      setNotice({ tone: "success", message: `${payload.businessName} settings saved.` });
    } catch {
      setNotice({ tone: "error", message: "Could not save settings. Check the connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        body="Configure business profile, hours, live open status, service radius, payment options, and order rules."
        action={<LiveSyncStatus connected={connected} source={data.source} error={error} />}
      />
      <form key={business.id} noValidate className="grid items-start gap-5" onSubmit={submitSettings}>
        <SettingsAccordionSection
          sectionId="business-profile"
          title="Business profile"
          description="Identity, owner details, contact channels, address, map pin, and hours."
          icon={<BusinessIcon className="size-5" />}
          accent="ocean"
          open={isSettingsSectionOpen("business-profile")}
          onToggle={toggleSettingsSection}
          saveLabel="Save Business Profile"
          saving={saving}
        >
            <BusinessImageUploadField
              imageUrl={business.logoUrl}
              disabled={saving}
              onPendingImageChange={setPendingLogoImageDataUrl}
              onError={handleBusinessImageError}
            />
            <div className="grid gap-2">
              <Label>Business name</Label>
              <Input name="businessName" defaultValue={business.name} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Registered owner</Label>
                <Input name="ownerName" defaultValue={business.ownerName} />
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
            <div className="grid gap-2">
              <Label>Contact email</Label>
              <Input name="email" type="email" defaultValue={business.email} />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Textarea
                name="address"
                value={businessAddressValue}
                onChange={(event) => setBusinessAddressDraft(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>City</Label>
                <Input name="city" defaultValue={business.city} />
              </div>
              <div>
                <Label>State</Label>
                <Input name="state" defaultValue={business.state} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Business location map</Label>
              <BusinessLocationMapPicker
                key={`${business.id}-${business.latitude ?? "none"}-${business.longitude ?? "none"}`}
                defaultLatitude={business.latitude}
                defaultLongitude={business.longitude}
                address={businessAddressValue}
                city={business.city}
                state={business.state}
                businessName={business.name}
                onAddressSelect={setBusinessAddressDraft}
              />
            </div>
            <div className="grid gap-2">
              <Label>Business hours</Label>
              <BusinessHoursEditor name="businessHours" defaultValue={business.hours} />
            </div>
            <div className="grid gap-2">
              <Label>WhatsApp number</Label>
              <PhoneInput name="phone" defaultValue={business.phone} />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-mist p-3">
              <span>
                <span className="block text-sm font-bold text-ink">Accept bookings</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Customers only see it while this is on and the business hours above are open.</span>
              </span>
              <input name="isOpen" type="checkbox" defaultChecked={business.isOpen} className="peer sr-only" />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
        </SettingsAccordionSection>
        <SettingsAccordionSection
          sectionId="wallet-payout"
          title="Wallet payout destination"
          description="Settlement method, account holder, UPI, and bank transfer details."
          icon={<Landmark className="size-5" />}
          accent="violet"
          open={isSettingsSectionOpen("wallet-payout")}
          onToggle={toggleSettingsSection}
          saveLabel="Save Payout Details"
          saving={saving}
        >
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
              Eligible wallet balance is sent automatically to this saved destination after provider settlement. Cashfree payout status appears on the payments page.
            </div>
        </SettingsAccordionSection>
        <SettingsAccordionSection
          sectionId="whatsapp-api"
          title="WhatsApp Business API"
          description="Customer chat flow, approval state, and display number."
          icon={<MessageCircle className="size-5" />}
          badge={
            <Badge variant={business.whatsappLiveEnabled ? "emerald" : business.whatsappConnected ? "amber" : "neutral"}>
              {business.whatsappLiveEnabled ? "Enabled" : business.whatsappConnected ? "Pending PSHR approval" : "Not configured"}
            </Badge>
          }
          accent="emerald"
          open={isSettingsSectionOpen("whatsapp-api")}
          onToggle={toggleSettingsSection}
          saveLabel="Save WhatsApp Settings"
          saving={saving}
        >
            <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-mist p-3">
              <span>
                <span className="block text-sm font-bold text-ink">Enable WhatsApp customer flow</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">When off, public ordering stays website-only and WhatsApp buttons are hidden.</span>
              </span>
              <input
                name="whatsappEnabled"
                type="checkbox"
                defaultChecked={Boolean(business.whatsappDisplayPhone || business.whatsappConnected || business.whatsappLiveEnabled)}
                className="peer sr-only"
              />
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
            <div className="grid gap-2">
              <Label>WhatsApp display number</Label>
              <PhoneInput name="whatsappDisplayPhone" defaultValue={business.whatsappDisplayPhone ?? business.phone} />
            </div>
        </SettingsAccordionSection>
        <SettingsAccordionSection
          sectionId="payment-rules"
          title="Billing and payment settings"
          description="Minimum value, fulfillment choices, service radius, and cash payments."
          icon={<TransactionIcon className="size-5" />}
          accent="ocean"
          open={isSettingsSectionOpen("payment-rules")}
          onToggle={toggleSettingsSection}
          saveLabel="Save Billing Settings"
          saving={saving}
        >
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>{copy.minimumValueLabel}</Label>
                <Input name="minimumOrder" type="number" min="0" defaultValue={business.minimumOrder} />
              </div>
              <div>
                <Label>{copy.serviceFeeLabel}</Label>
                <Input name="deliveryFee" type="number" min="0" defaultValue={business.deliveryFee} />
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-line bg-mist p-3">
              <Label>Fulfillment options</Label>
              <div key={activeBusinessType} className="grid gap-3 sm:grid-cols-3">
                {activeFulfillmentProfile.allowedModes.map((mode: ActiveFulfillmentMode) => {
                  const ModeIcon = fulfillmentModeIcons[mode];

                  return (
                    <label key={mode} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        name={fulfillmentModeFlagNames[mode]}
                        type="checkbox"
                        defaultChecked={selectedFulfillmentModeSet.has(mode)}
                      />
                      <ModeIcon className="size-4 text-ocean" />
                      {fulfillmentLabelForBusinessType(activeBusinessType, mode)}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-line bg-mist p-3">
              <div>
                <p className="text-sm font-bold text-ink">Platform online payments</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Customer online payments are collected through the PSHR Innovex gateway account. Paid orders credit your business wallet and are paid to your saved payout destination in the daily 9 AM IST batch within 24 hours.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-line bg-mist p-3 text-sm font-semibold text-slate-700">
              <input name="allowsPayLater" type="checkbox" defaultChecked={business.allowsPayLater} />
              Allow cash payment
            </label>
            <div className="grid gap-2">
              <Label>Service radius in km</Label>
              <Input name="serviceRadiusKm" type="number" min="0" step="0.1" defaultValue={business.serviceRadiusKm} />
            </div>
        </SettingsAccordionSection>
      </form>
      <PasswordChangeCard
        portal="business"
        title="Business account password"
        body="Change the password used for dashboard sign-in."
      />
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

export function CustomerCouponsPage() {
  const { data, connected, error, loading, refresh } = useDashboardLive();
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const [createCouponOpen, setCreateCouponOpen] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponActionId, setCouponActionId] = useState<string | null>(null);
  const activeCouponCount = data.coupons.filter((coupon) => coupon.isActive).length;
  const totalRedemptions = data.coupons.reduce((sum, coupon) => sum + coupon.redeemedCount, 0);
  const couponPagination = usePaginatedItems(data.coupons, {
    resetKey: `${data.coupons.length}-${data.coupons[0]?.id ?? "empty"}-${data.coupons.at(-1)?.id ?? "empty"}`
  });

  if (loading) return <DashboardPageSkeleton variant="cards" />;

  async function createBusinessCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const expiresDate = formString(formData, "expiresAt", "");
    const payload = {
      code: formString(formData, "code", ""),
      description: formString(formData, "description", ""),
      discountType: formString(formData, "discountType", "PERCENTAGE"),
      discountValue: formNumber(formData, "discountValue", 0),
      maxDiscountAmount: formOptionalNumber(formData, "maxDiscountAmount"),
      minimumOrderAmount: formNumber(formData, "minimumOrderAmount", 0),
      redemptionLimit: formOptionalNumber(formData, "redemptionLimit"),
      expiresAt: expiresDate ? new Date(`${expiresDate}T23:59:59+05:30`).toISOString() : undefined,
      isActive: true
    };

    setSavingCoupon(true);
    setNotice(null);
    try {
      const response = await fetch("/api/dashboard/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readActionError(response, "Could not create coupon.") });
        return;
      }
      form.reset();
      await refresh();
      setCreateCouponOpen(false);
      setNotice({ tone: "success", message: `Coupon ${payload.code.toUpperCase()} created.` });
    } catch {
      setNotice({ tone: "error", message: "Could not create coupon. Check the connection and try again." });
    } finally {
      setSavingCoupon(false);
    }
  }

  async function updateBusinessCoupon(couponId: string, payload: Record<string, unknown>, successMessage: string) {
    setCouponActionId(couponId);
    setNotice(null);
    try {
      const response = await fetch(`/api/dashboard/coupons/${encodeURIComponent(couponId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readActionError(response, "Could not update coupon.") });
        return;
      }
      await refresh();
      setNotice({ tone: "success", message: successMessage });
    } catch {
      setNotice({ tone: "error", message: "Could not update coupon. Check the connection and try again." });
    } finally {
      setCouponActionId(null);
    }
  }

  async function deleteBusinessCoupon(couponId: string, code: string) {
    setCouponActionId(couponId);
    setNotice(null);
    try {
      const response = await fetch(`/api/dashboard/coupons/${encodeURIComponent(couponId)}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice({ tone: "error", message: await readActionError(response, "Could not remove coupon.") });
        return;
      }
      await refresh();
      setNotice({ tone: "success", message: `Coupon ${code} removed.` });
    } catch {
      setNotice({ tone: "error", message: "Could not remove coupon. Check the connection and try again." });
    } finally {
      setCouponActionId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Customer coupons"
        body="Create coupons customers can apply on the public checkout page."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="emerald"
              icon={<Plus className="size-4" />}
              onClick={() => {
                setNotice(null);
                setCreateCouponOpen(true);
              }}
            >
              Create coupon
            </Button>
            <LiveSyncStatus connected={connected} source={data.source} error={error} />
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Total coupons" value={String(data.coupons.length)} detail="Configured checkout offers" icon={ReceiptText} tone="blue" />
        <MetricCard title="Active coupons" value={String(activeCouponCount)} detail="Available on public checkout" icon={CheckCircle2} tone="emerald" />
        <MetricCard title="Total redemptions" value={String(totalRedemptions)} detail="Claims across all coupons" icon={TrendingUp} tone="purple" />
      </div>
      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">Coupon list</h2>
            <p className="mt-1 text-sm text-slate-600">Use the status switch to activate or pause coupons, or remove unused entries.</p>
          </div>
          <Badge variant="blue">{data.coupons.length} coupons</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {couponPagination.pageItems.map((coupon) => {
            const busy = couponActionId === coupon.id;
            const discountLabel = coupon.discountType === "PERCENTAGE"
              ? `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` up to ${formatINR(coupon.maxDiscountAmount)}` : ""}`
              : formatINR(coupon.discountValue);
            return (
              <div key={coupon.id} className="grid gap-3 rounded-lg border border-line bg-mist p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{coupon.code}</p>
                    <Badge variant={coupon.isActive ? "emerald" : "neutral"}>{coupon.isActive ? "Active" : "Inactive"}</Badge>
                    <Badge variant="blue">{coupon.redeemedCount}{coupon.redemptionLimit ? `/${coupon.redemptionLimit}` : ""} used</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {discountLabel} off{coupon.minimumOrderAmount > 0 ? ` above ${formatINR(coupon.minimumOrderAmount)}` : ""}{coupon.expiresAt ? ` · expires ${formatDateLabel(coupon.expiresAt)}` : ""}
                  </p>
                  {coupon.description && <p className="mt-1 text-xs text-slate-500">{coupon.description}</p>}
                </div>
                <StatusSwitch
                  checked={coupon.isActive}
                  loading={busy}
                  aria-label={`Turn coupon ${coupon.code} ${coupon.isActive ? "inactive" : "active"}`}
                  onCheckedChange={(isActive) => updateBusinessCoupon(coupon.id, { isActive }, isActive ? `Coupon ${coupon.code} activated.` : `Coupon ${coupon.code} paused.`)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  icon={busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  disabled={busy}
                  onClick={() => deleteBusinessCoupon(coupon.id, coupon.code)}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          {data.coupons.length === 0 && (
            <p className="rounded-lg bg-mist p-3 text-sm text-slate-500">No customer coupons are configured yet.</p>
          )}
        </div>
        <PaginationControls
          className="mt-4 rounded-lg border border-line bg-white"
          page={couponPagination.page}
          pageCount={couponPagination.pageCount}
          totalItems={couponPagination.totalItems}
          startItem={couponPagination.startItem}
          endItem={couponPagination.endItem}
          itemLabel="coupons"
          onPageChange={couponPagination.setPage}
        />
      </Card>
      {createCouponOpen && (
        <ActionDialog
          title="Create coupon"
          body="Discount is applied before the checkout total is sent to the payment gateway."
          onClose={() => setCreateCouponOpen(false)}
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createBusinessCoupon}>
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
              <Input name="maxDiscountAmount" type="number" min="0" step="0.01" placeholder="Optional cap" />
            </div>
            <div className="grid gap-1">
              <Label>Limit</Label>
              <Input name="redemptionLimit" type="number" min="1" step="1" placeholder="No limit" />
            </div>
            <div className="grid gap-1">
              <Label>Expires</Label>
              <Input name="expiresAt" type="date" />
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setCreateCouponOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="emerald"
                disabled={savingCoupon}
                icon={savingCoupon ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              >
                {savingCoupon ? "Creating" : "Create coupon"}
              </Button>
            </div>
          </form>
        </ActionDialog>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}

function ResponsiveOrderTable({
  orders,
  transactionLabel = "Order",
  businessType
}: {
  orders: LiveOrder[];
  transactionLabel?: string;
  businessType: string;
}) {
  const orderPagination = usePaginatedItems(orders, {
    resetKey: `${orders.length}-${orders[0]?.id ?? "empty"}-${orders.at(-1)?.id ?? "empty"}`
  });

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>{[transactionLabel, "Customer", "Items", "Amount", "Status", "Payment", "Time"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orderPagination.pageItems.map((order) => (
              <tr key={order.id}>
                <td className="px-3 py-4 font-bold text-ink">{order.orderNumber}</td>
                <td className="px-3 py-4 text-slate-600">{order.customer}</td>
                <td className="px-3 py-4 text-slate-600">{order.items}</td>
                <td className="px-3 py-4 font-bold">{formatINR(order.amount)}</td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <OrderStatusAnimation
                      status={order.status}
                      businessType={businessType}
                      orderType={order.orderType}
                      label={getOrderTrackingStatusLabel(businessType, order.orderType, order.status)}
                      className="size-8"
                    />
                    <StatusPill status={order.status} label={getOrderTrackingStatusLabel(businessType, order.orderType, order.status)} />
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <PaymentStatusAnimation status={order.paymentStatus} label={`${order.paymentStatus.toLowerCase()} payment`} className="size-8" />
                    <StatusPill status={order.paymentStatus} />
                  </div>
                </td>
                <td className="px-3 py-4 text-slate-500">{order.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls
        className="mt-3 rounded-lg border border-line bg-white"
        page={orderPagination.page}
        pageCount={orderPagination.pageCount}
        totalItems={orderPagination.totalItems}
        startItem={orderPagination.startItem}
        endItem={orderPagination.endItem}
        itemLabel={`${transactionLabel.toLowerCase()} rows`}
        onPageChange={orderPagination.setPage}
      />
    </>
  );
}

function statusBarColor(status: LiveOrderStatus) {
  const colors: Record<LiveOrderStatus, string> = {
    NEW: "bg-ocean",
    ACCEPTED: "bg-violet",
    PREPARING: "bg-amber-500",
    READY: "bg-emerald",
    DELIVERED: "bg-slate-500",
    CANCELLED: "bg-red-500"
  };
  return colors[status];
}

function replaceOrder(payload: LiveDashboardPayload, updatedOrder: LiveOrder): LiveDashboardPayload {
  const orders = payload.orders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
  const recentOrders = payload.recentOrders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
  const statusCounts = orderStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: orders.filter((order) => order.status === status).length
    }),
    {} as Record<LiveOrderStatus, number>
  );

  return { ...payload, orders, recentOrders, statusCounts, syncedAt: new Date().toISOString() };
}

function removeOrder(payload: LiveDashboardPayload, orderId: string): LiveDashboardPayload {
  const orders = payload.orders.filter((order) => order.id !== orderId);
  const recentOrders = payload.recentOrders.filter((order) => order.id !== orderId);
  const payments = payload.payments.filter((payment) => payment.orderId !== orderId);
  const statusCounts = orderStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: orders.filter((order) => order.status === status).length
    }),
    {} as Record<LiveOrderStatus, number>
  );

  return { ...payload, orders, recentOrders, payments, statusCounts, syncedAt: new Date().toISOString() };
}

function removeCustomer(payload: LiveDashboardPayload, customer: LiveDashboardPayload["customers"][number]): LiveDashboardPayload {
  const customers = payload.customers.filter((existing) => existing.id !== customer.id);
  const orders = payload.orders.filter((order) => order.customerPhone !== customer.phone && order.customer !== customer.name);
  const recentOrders = payload.recentOrders.filter((order) => order.customerPhone !== customer.phone && order.customer !== customer.name);
  const payments = payload.payments.filter((payment) => payment.customer !== customer.name);
  const repeatCustomers = customers.filter((existing) => existing.totalOrders > 1).length;
  const statusCounts = orderStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: orders.filter((order) => order.status === status).length
    }),
    {} as Record<LiveOrderStatus, number>
  );

  return {
    ...payload,
    orders,
    recentOrders,
    payments,
    customers,
    statusCounts,
    metrics: {
      ...payload.metrics,
      repeatCustomers,
      totalCustomers: customers.length,
      repeatRate: customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0
    },
    syncedAt: new Date().toISOString()
  };
}

function trendBarHeight(revenue: number, maxRevenue: number) {
  if (maxRevenue <= 0) return 8;
  return Math.max(8, Math.round((revenue / maxRevenue) * 210));
}

function formatSignedPercent(value: number) {
  return value > 0 ? `+${value}%` : `${value}%`;
}

function formatPlanName(plan: string) {
  return plan
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function billingStatusVariant(status: string): "neutral" | "blue" | "emerald" | "purple" | "amber" | "red" {
  if (status === "ACTIVE") return "emerald";
  if (status === "TRIAL") return "purple";
  if (status === "PAST_DUE") return "amber";
  if (status === "CANCELLED") return "red";
  return "neutral";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
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
