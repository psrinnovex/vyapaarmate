import type { Prisma, SubscriptionStatus, WalletEntryStatus, WalletEntryType } from "@prisma/client";
import { fulfillmentModesFromFlags } from "@/lib/business-rules";
import {
  emptyOrderStatusCounts,
  getEmptyDashboardPayload,
  type LiveBillingHistoryItem,
  type LiveAdminBusiness,
  type LiveAdminLog,
  type LiveAdminLogStatus,
  type LiveAdminPayload,
  type LiveAdminSubscription,
  type LiveBusinessCoupon,
  type LiveDashboardPayload,
  type LiveKycDocument,
  type LiveKycStatus,
  type LiveOrder,
  type LiveOrderStatus,
  type LivePayment,
  type LivePaymentStatus,
  type LiveSubscriptionPlan,
  type LiveSubscriptionStatus,
  type LiveTopItem
} from "@/lib/live-types";
import { formatSubscriptionPlan, paidSubscriptionAmount, subscriptionPlanAmounts, sumPaidSubscriptionAmounts } from "@/lib/billing";
import { getBusinessLogoUrl } from "@/lib/business-image";
import { formatKycStatus, hasAllRequiredKycDocuments, kycDocumentLabel, kycDocumentRequirements } from "@/lib/kyc";
import { subscribeToLiveChanges, type LiveChangePayload } from "@/lib/postgres-live-events";
import { prisma } from "@/lib/prisma";

type OrderWithRelations = Prisma.OrderGetPayload<{
  select: {
    id: true;
    orderNumber: true;
    totalAmount: true;
    status: true;
    paymentStatus: true;
    orderType: true;
    notes: true;
    createdAt: true;
    customer: { select: { name: true; phone: true; whatsappOptIn: true } };
    items: { select: { itemName: true; quantity: true } };
  };
}>;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  select: {
    id: true;
    orderId: true;
    amount: true;
    provider: true;
    cashfreePaymentId: true;
    cashfreeOrderId: true;
    status: true;
    paymentRequestUrl: true;
    createdAt: true;
    order: { select: { orderNumber: true; publicToken: true; customer: { select: { name: true } } } };
    walletEntry: { select: { amount: true; status: true; platformFee: true } };
  };
}>;

type MenuItemWithCategory = Prisma.MenuItemGetPayload<{
  include: { category: true };
}>;

type ReportPayment = {
  amount: Prisma.Decimal;
  createdAt: Date;
};

type ReportOrder = {
  createdAt: Date;
  customerId: string;
};

type SubscriptionRow = Prisma.SubscriptionGetPayload<Record<string, never>>;
type BusinessCouponRow = Prisma.BusinessCouponGetPayload<Record<string, never>>;
type DashboardBusinessRow = Prisma.BusinessGetPayload<{
  include: { logoImage: { select: { updatedAt: true } } };
}>;

const dashboardBusinessInclude = {
  logoImage: { select: { updatedAt: true } }
} satisfies Prisma.BusinessInclude;
const adminSubscriptionSelect = {
  id: true,
  invoiceNumber: true,
  businessId: true,
  plan: true,
  amount: true,
  status: true,
  paymentStatus: true,
  paymentProvider: true,
  cashfreePaymentId: true,
  cashfreeOrderId: true,
  paidAt: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  business: { select: { id: true, name: true, ownerName: true, phone: true, email: true } }
} satisfies Prisma.SubscriptionSelect;
type AdminSubscriptionRow = Prisma.SubscriptionGetPayload<{
  select: typeof adminSubscriptionSelect;
}>;
const adminAuditLogSelect = {
  id: true,
  userId: true,
  businessId: true,
  action: true,
  entity: true,
  entityId: true,
  createdAt: true,
  business: { select: { id: true, name: true } },
  user: { select: { name: true, email: true } }
} satisfies Prisma.AuditLogSelect;
type AdminAuditLogRow = Prisma.AuditLogGetPayload<{
  select: typeof adminAuditLogSelect;
}>;
const adminWhatsappLogSelect = {
  id: true,
  businessId: true,
  providerMessageId: true,
  templateName: true,
  phone: true,
  status: true,
  sentAt: true,
  deliveredAt: true,
  failedAt: true,
  errorMessage: true,
  business: { select: { id: true, name: true } },
  customer: { select: { name: true } },
  order: { select: { orderNumber: true } }
} satisfies Prisma.WhatsappMessageSelect;
type AdminWhatsappLogRow = Prisma.WhatsappMessageGetPayload<{
  select: typeof adminWhatsappLogSelect;
}>;
const adminPaymentLogSelect = {
  id: true,
  businessId: true,
  provider: true,
  status: true,
  amount: true,
  cashfreePaymentId: true,
  cashfreeOrderId: true,
  cashfreeOrderStatus: true,
  manualVerificationReference: true,
  paidAt: true,
  createdAt: true,
  business: { select: { id: true, name: true } },
  order: { select: { orderNumber: true } }
} satisfies Prisma.PaymentSelect;
type AdminPaymentLogRow = Prisma.PaymentGetPayload<{
  select: typeof adminPaymentLogSelect;
}>;
type KycDocumentRow = Prisma.BusinessKycDocumentGetPayload<{
  select: {
    id: true;
    businessId: true;
    type: true;
    fileName: true;
    contentType: true;
    fileSize: true;
    uploadedAt: true;
  };
}>;
type TopOrderItemSummary = {
  itemName: string;
  _sum?: {
    quantity?: number | null;
    total?: Prisma.Decimal | null;
  };
};
type WalletEntrySummary = {
  type: WalletEntryType;
  status: WalletEntryStatus;
  _sum?: {
    amount?: Prisma.Decimal | null;
    grossAmount?: Prisma.Decimal | null;
    platformFee?: Prisma.Decimal | null;
  };
};
type WalletPayoutSummary = {
  _sum: {
    amount: Prisma.Decimal | null;
  };
};
type RawOrderItem = {
  itemName: string;
  quantity: number;
};
type RawRecentOrderRow = {
  id: string;
  orderNumber: string;
  totalAmount: Prisma.Decimal;
  status: string;
  paymentStatus: string;
  orderType: LiveOrder["orderType"];
  notes: string | null;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  customerWhatsappOptIn: boolean;
  items: RawOrderItem[] | null;
};
type RawOverviewMetricsRow = {
  ordersToday: number;
  revenueToday: Prisma.Decimal | null;
  pendingPaymentsAmount: Prisma.Decimal | null;
  pendingPaymentsCount: number;
  repeatCustomers: number;
  totalCustomers: number;
  statusCounts: Prisma.JsonValue | null;
};
type RawTopItemRow = {
  id: string | null;
  name: string;
  category: string | null;
  price: Prisma.Decimal | null;
  quantitySold: number | null;
  revenue: Prisma.Decimal | null;
};
type RawPaymentRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  publicToken: string;
  customerName: string;
  amount: Prisma.Decimal;
  provider: string;
  cashfreePaymentId: string | null;
  cashfreeOrderId: string | null;
  status: string;
  paymentRequestUrl: string | null;
  createdAt: Date;
  walletAmount: Prisma.Decimal | null;
  walletStatus: WalletEntryStatus | null;
  walletPlatformFee: Prisma.Decimal | null;
};
type RawPaymentSummaryRow = {
  pendingPaymentsAmount: Prisma.Decimal | null;
  pendingPaymentsCount: number;
  grossCredited: Prisma.Decimal | null;
  platformFees: Prisma.Decimal | null;
  pendingProviderSettlement: Prisma.Decimal | null;
  availableForPayout: Prisma.Decimal | null;
  processingPayouts: Prisma.Decimal | null;
  settledCredits: Prisma.Decimal | null;
  paidOut: Prisma.Decimal | null;
};
type RawCustomerCountsRow = {
  repeatCustomers: number;
  totalCustomers: number;
};
export type DashboardLiveScope =
  | "full"
  | "overview"
  | "orders"
  | "menu"
  | "payments"
  | "invoices"
  | "customers"
  | "coupons"
  | "campaigns"
  | "staff"
  | "reports"
  | "billing"
  | "settings";

const LIVE_STREAM_REFRESH_INTERVAL_MS = 120000;
export const DASHBOARD_ORDERS_STREAM_REFRESH_INTERVAL_MS = 12000;

const businessScopedTables = new Set([
  "AIInsight",
  "AuditLog",
  "Business",
  "BusinessCoupon",
  "BusinessImage",
  "BusinessKycDocument",
  "BusinessPayout",
  "BusinessHealthSnapshot",
  "BusinessWalletEntry",
  "Customer",
  "CustomerIntelligenceScore",
  "DemandForecast",
  "MenuCategory",
  "MenuItem",
  "MenuItemImage",
  "Order",
  "OrderItem",
  "Payment",
  "PaymentPriority",
  "Subscription",
  "SupportTicket",
  "SupportTicketMessage",
  "User",
  "WhatsappMessage"
]);

const globalTables = new Set(["BusinessServiceType", "PlatformPaymentSettings", "PlatformSubscriptionCoupon"]);
const dashboardScopeTables: Record<DashboardLiveScope, Set<string>> = {
  full: new Set([...businessScopedTables, ...globalTables]),
  overview: new Set(["Business", "BusinessImage", "BusinessWalletEntry", "BusinessPayout", "Customer", "MenuCategory", "MenuItem", "Order", "OrderItem", "Payment", "Subscription", "WhatsappMessage"]),
  orders: new Set(["Customer", "Order", "OrderItem", "Payment", "WhatsappMessage"]),
  menu: new Set(["Business", "MenuCategory", "MenuItem", "MenuItemImage", "Order", "OrderItem"]),
  payments: new Set(["BusinessWalletEntry", "BusinessPayout", "Order", "Payment", "PlatformPaymentSettings"]),
  invoices: new Set(["Business", "Order", "Payment", "Subscription"]),
  customers: new Set(["Customer", "Order", "Payment", "WhatsappMessage"]),
  coupons: new Set(["BusinessCoupon", "Order"]),
  campaigns: new Set(["Customer", "WhatsappMessage"]),
  staff: new Set(["User"]),
  reports: new Set(["Customer", "Order", "OrderItem", "Payment"]),
  billing: new Set(["Business", "PlatformSubscriptionCoupon", "Subscription"]),
  settings: new Set(["Business", "BusinessImage", "BusinessServiceType", "PlatformPaymentSettings"])
};
const adminTables = new Set([...businessScopedTables, ...globalTables]);

export class LiveDataNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveDataNotFoundError";
  }
}

function timeAgo(date: Date | null | undefined) {
  if (!date) return "Never";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function daysAgoStart(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthTrendStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 11, 1);
}

function inRange(date: Date, start: Date, end?: Date) {
  return date >= start && (!end || date < end);
}

function sumPayments(payments: ReportPayment[], start: Date, end?: Date) {
  return payments
    .filter((payment) => inRange(payment.createdAt, start, end))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function countOrders(orders: ReportOrder[], start: Date, end?: Date) {
  return orders.filter((order) => inRange(order.createdAt, start, end)).length;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function buildMonthlyTrend(payments: ReportPayment[], orders: ReportOrder[]) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1));

  return months.map((month) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return {
      label: month.toLocaleDateString("en-IN", { month: "short" }),
      revenue: sumPayments(payments, month, nextMonth),
      orders: countOrders(orders, month, nextMonth)
    };
  });
}

function billingMonthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function formatOrderItems(items: OrderWithRelations["items"]) {
  return items.map((item) => `${item.itemName} x${item.quantity}`).join(", ");
}

function mapOrder(order: OrderWithRelations): LiveOrder {
  const amount = Number(order.totalAmount);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer.name,
    customerPhone: order.customer.phone,
    items: formatOrderItems(order.items),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    amount,
    status: order.status as LiveOrderStatus,
    paymentStatus: order.paymentStatus as LivePaymentStatus,
    channel: order.customer.whatsappOptIn ? "WhatsApp" : "Direct Link",
    time: timeAgo(order.createdAt),
    createdAt: order.createdAt.toISOString(),
    orderType: order.orderType,
    notes: order.notes
  };
}

function mapRawRecentOrder(order: RawRecentOrderRow): LiveOrder {
  const items = Array.isArray(order.items) ? order.items : [];
  const amount = Number(order.totalAmount);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customerName,
    customerPhone: order.customerPhone,
    items: formatOrderItems(items),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    amount,
    status: order.status as LiveOrderStatus,
    paymentStatus: order.paymentStatus as LivePaymentStatus,
    channel: order.customerWhatsappOptIn ? "WhatsApp" : "Direct Link",
    time: timeAgo(order.createdAt),
    createdAt: order.createdAt.toISOString(),
    orderType: order.orderType,
    notes: order.notes
  };
}

function mapPayment(payment: PaymentWithRelations): LivePayment {
  const paymentId = payment.cashfreePaymentId ?? payment.cashfreeOrderId ?? payment.id;
  const walletStatus =
    payment.walletEntry?.status === "PENDING_PROVIDER_SETTLEMENT"
      ? "Pending 9 AM payout batch"
      : payment.walletEntry?.status === "AVAILABLE"
        ? "Available for payout"
        : payment.walletEntry?.status === "PROCESSING_PAYOUT"
          ? "Payout processing"
          : payment.walletEntry?.status === "SETTLED"
            ? "Paid out"
            : payment.walletEntry?.status === "CANCELLED"
              ? "Cancelled"
              : payment.provider === "CASHFREE"
                ? payment.status === "COMPLETED" ? "Credit pending" : "Not credited"
                : "Business collected";

  return {
    id: payment.id,
    orderId: payment.orderId,
    orderNumber: payment.order.orderNumber,
    customer: payment.order.customer.name,
    amount: Number(payment.amount),
    provider: payment.provider === "CASHFREE" ? "Cashfree" : payment.provider === "UPI" ? "PSHR Innovex UPI" : payment.provider === "CASH" ? "Cash" : "Online payment",
    paymentId,
    status: payment.status as LivePaymentStatus,
    walletAmount: Number(payment.walletEntry?.amount ?? 0),
    walletStatus,
    platformFee: Number(payment.walletEntry?.platformFee ?? 0),
    linkStatus:
      payment.status === "COMPLETED"
        ? "paid"
        : payment.status === "FAILED"
          ? "failed"
          : payment.paymentRequestUrl
          ? payment.provider === "CASHFREE" ? "checkout ready" : "website QR ready"
          : payment.provider === "CASH"
            ? "cash due"
            : payment.provider === "UPI"
              ? "awaiting PSHR verification"
            : "pending",
    refundStatus: payment.status === "REFUNDED" ? "refunded" : "none",
    invoiceUrl: `/order/${payment.order.publicToken}#invoice`,
    canMarkPaid: payment.provider === "CASH" && payment.status === "PENDING",
    createdAt: payment.createdAt.toISOString()
  };
}

function mapRawPayment(payment: RawPaymentRow): LivePayment {
  const paymentId = payment.cashfreePaymentId ?? payment.cashfreeOrderId ?? payment.id;
  const walletStatus =
    payment.walletStatus === "PENDING_PROVIDER_SETTLEMENT"
      ? "Pending 9 AM payout batch"
      : payment.walletStatus === "AVAILABLE"
        ? "Available for payout"
        : payment.walletStatus === "PROCESSING_PAYOUT"
          ? "Payout processing"
          : payment.walletStatus === "SETTLED"
            ? "Paid out"
            : payment.walletStatus === "CANCELLED"
              ? "Cancelled"
              : payment.provider === "CASHFREE"
                ? payment.status === "COMPLETED" ? "Credit pending" : "Not credited"
                : "Business collected";

  return {
    id: payment.id,
    orderId: payment.orderId,
    orderNumber: payment.orderNumber,
    customer: payment.customerName,
    amount: Number(payment.amount),
    provider: payment.provider === "CASHFREE" ? "Cashfree" : payment.provider === "UPI" ? "PSHR Innovex UPI" : payment.provider === "CASH" ? "Cash" : "Online payment",
    paymentId,
    status: payment.status as LivePaymentStatus,
    walletAmount: Number(payment.walletAmount ?? 0),
    walletStatus,
    platformFee: Number(payment.walletPlatformFee ?? 0),
    linkStatus:
      payment.status === "COMPLETED"
        ? "paid"
        : payment.status === "FAILED"
          ? "failed"
          : payment.paymentRequestUrl
          ? payment.provider === "CASHFREE" ? "checkout ready" : "website QR ready"
          : payment.provider === "CASH"
            ? "cash due"
            : payment.provider === "UPI"
              ? "awaiting PSHR verification"
              : "pending",
    refundStatus: payment.status === "REFUNDED" ? "refunded" : "none",
    invoiceUrl: `/order/${payment.publicToken}#invoice`,
    canMarkPaid: payment.provider === "CASH" && payment.status === "PENDING",
    createdAt: payment.createdAt.toISOString()
  };
}

function mapMenuItem(item: MenuItemWithCategory, quantitySold = 0, revenue = 0): LiveTopItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category.name,
    price: Number(item.price),
    quantitySold,
    revenue
  };
}

function mapBillingHistory(subscription: SubscriptionRow): LiveBillingHistoryItem {
  return {
    id: subscription.id,
    label: billingMonthLabel(subscription.startDate),
    amount: Number(subscription.amount),
    status: subscription.paymentStatus === "COMPLETED" ? subscription.status : subscription.paymentStatus,
    reference: subscription.invoiceNumber ?? `SUB-${subscription.id.slice(-6).toUpperCase()}`,
    provider: subscriptionPaymentProviderLabel(subscription.paymentProvider),
    periodStart: subscription.startDate.toISOString(),
    periodEnd: subscription.endDate.toISOString(),
    issuedAt: subscription.createdAt.toISOString(),
    invoiceUrl: `/dashboard/billing/invoices/${subscription.id}`
  };
}

function isVisibleBillingHistorySubscription(subscription: SubscriptionRow) {
  return subscription.paymentStatus !== "PENDING";
}

function mapBusinessCoupon(coupon: BusinessCouponRow): LiveBusinessCoupon {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
    minimumOrderAmount: Number(coupon.minimumOrderAmount),
    redemptionLimit: coupon.redemptionLimit,
    redeemedCount: coupon.redeemedCount,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString()
  };
}

function subscriptionPaymentProviderLabel(provider: string) {
  if (provider === "CASHFREE") return "Cashfree";
  if (provider === "UPI") return "PSHR Innovex UPI";
  if (provider === "CASH") return "Cash";
  return "Online payment";
}

function mapAdminSubscription(subscription: AdminSubscriptionRow): LiveAdminSubscription {
  return {
    id: subscription.id,
    reference: subscription.invoiceNumber ?? `SUB-${subscription.id.slice(-8).toUpperCase()}`,
    invoiceUrl: `/dashboard/billing/invoices/${subscription.id}`,
    businessId: subscription.business.id,
    businessName: subscription.business.name,
    ownerName: subscription.business.ownerName,
    ownerPhone: subscription.business.phone,
    ownerEmail: subscription.business.email,
    plan: subscription.plan as LiveSubscriptionPlan,
    amount: Number(subscription.amount),
    status: subscription.status as LiveSubscriptionStatus,
    paymentState: subscription.paymentStatus as LivePaymentStatus,
    paymentProvider: subscription.paymentProvider,
    paymentProviderLabel: subscriptionPaymentProviderLabel(subscription.paymentProvider),
    paidAt: subscription.paidAt?.toISOString() ?? null,
    periodStart: subscription.startDate.toISOString(),
    periodEnd: subscription.endDate.toISOString(),
    createdAt: subscription.createdAt.toISOString()
  };
}

function auditLogStatus(action: string): LiveAdminLogStatus {
  const normalized = action.toUpperCase();
  if (normalized.includes("FAILED") || normalized.includes("REJECTED")) return "FAILED";
  if (normalized.includes("PENDING") || normalized.includes("REQUESTED") || normalized.includes("SUBMITTED")) return "PENDING";
  if (normalized.includes("ENABLED") || normalized.includes("ACTIVE") || normalized.includes("UPDATED")) return "ACTIVE";
  return "COMPLETED";
}

function paymentLogStatus(status: string): LiveAdminLogStatus {
  if (status === "FAILED") return "FAILED";
  if (status === "PENDING") return "PENDING";
  if (status === "REFUNDED") return "ACTIVE";
  return "COMPLETED";
}

function shortReference(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function maskLogPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `**** ${digits.slice(-4)}`;
}

function whatsappOccurredAt(message: AdminWhatsappLogRow) {
  if (message.status === "FAILED") return message.failedAt ?? message.sentAt ?? message.deliveredAt;
  if (message.status === "DELIVERED") return message.deliveredAt ?? message.sentAt ?? message.failedAt;
  return message.sentAt ?? message.deliveredAt ?? message.failedAt;
}

function mapAdminAuditLog(log: AdminAuditLogRow): LiveAdminLog {
  return {
    id: log.id,
    source: "audit",
    action: log.action,
    entity: log.entity,
    status: auditLogStatus(log.action),
    businessId: log.businessId,
    businessName: log.business?.name ?? "Platform",
    actorName: log.user?.name ?? log.user?.email ?? "System",
    summary: `${log.entity}${log.entityId ? ` ${shortReference(log.entityId)}` : ""}`,
    detail: log.user ? "Admin action" : "System action",
    reference: shortReference(log.entityId),
    occurredAt: log.createdAt.toISOString()
  };
}

function mapAdminWhatsappLog(message: AdminWhatsappLogRow): LiveAdminLog {
  const occurredAt = whatsappOccurredAt(message);
  const orderDetail = message.order?.orderNumber ? `Order ${message.order.orderNumber}` : null;

  return {
    id: message.id,
    source: "whatsapp",
    action: message.templateName,
    entity: "WhatsappMessage",
    status: message.status as LiveAdminLogStatus,
    businessId: message.businessId,
    businessName: message.business.name,
    actorName: "WhatsApp Cloud API",
    summary: `${message.templateName} to ${message.customer?.name ?? maskLogPhone(message.phone)}`,
    detail: message.errorMessage ?? orderDetail,
    reference: shortReference(message.providerMessageId),
    occurredAt: occurredAt?.toISOString() ?? null
  };
}

function mapAdminPaymentLog(payment: AdminPaymentLogRow): LiveAdminLog {
  const providerLabel = subscriptionPaymentProviderLabel(payment.provider);
  const reference = payment.cashfreePaymentId ?? payment.cashfreeOrderId ?? payment.manualVerificationReference ?? payment.id;

  return {
    id: payment.id,
    source: "payment",
    action: `PAYMENT_${payment.status}`,
    entity: "Payment",
    status: paymentLogStatus(payment.status),
    businessId: payment.businessId,
    businessName: payment.business.name,
    actorName: providerLabel,
    summary: `${providerLabel} order payment ${payment.status.toLowerCase()}`,
    detail: payment.cashfreeOrderStatus ? `Gateway status ${payment.cashfreeOrderStatus}` : `Order ${payment.order.orderNumber}`,
    reference: shortReference(reference),
    occurredAt: (payment.paidAt ?? payment.createdAt).toISOString()
  };
}

function mapAdminSubscriptionPaymentLog(subscription: AdminSubscriptionRow): LiveAdminLog {
  const reference = subscription.invoiceNumber ?? `SUB-${subscription.id.slice(-8).toUpperCase()}`;
  const providerLabel = subscriptionPaymentProviderLabel(subscription.paymentProvider);

  return {
    id: `subscription_${subscription.id}`,
    source: "payment",
    action: `SUBSCRIPTION_PAYMENT_${subscription.paymentStatus}`,
    entity: "Subscription",
    status: paymentLogStatus(subscription.paymentStatus),
    businessId: subscription.businessId,
    businessName: subscription.business.name,
    actorName: providerLabel,
    summary: `${providerLabel} subscription payment ${subscription.paymentStatus.toLowerCase()}`,
    detail: `${subscription.plan} plan invoice ${reference}`,
    reference: shortReference(subscription.cashfreePaymentId ?? subscription.cashfreeOrderId ?? reference),
    occurredAt: (subscription.paidAt ?? subscription.createdAt).toISOString()
  };
}

function sortAdminLogs(logs: LiveAdminLog[]) {
  return [...logs].sort((first, second) => {
    const firstTime = first.occurredAt ? Date.parse(first.occurredAt) : 0;
    const secondTime = second.occurredAt ? Date.parse(second.occurredAt) : 0;
    return secondTime - firstTime;
  });
}

function mapKycDocument(document: KycDocumentRow, includeDownloadUrl = false): LiveKycDocument {
  return {
    id: document.id,
    type: document.type,
    label: kycDocumentLabel(document.type),
    fileName: document.fileName,
    contentType: document.contentType,
    fileSize: document.fileSize,
    uploadedAt: document.uploadedAt.toISOString(),
    ...(includeDownloadUrl
      ? { downloadUrl: `/api/admin/businesses/${encodeURIComponent(document.businessId)}/kyc/documents/${encodeURIComponent(document.id)}` }
      : {})
  };
}

function effectiveKycStatus(business: DashboardBusinessRow, documents: KycDocumentRow[]): LiveKycStatus {
  if (business.isVerified) return "APPROVED";
  if (business.subscriptionStatus !== "ACTIVE") return "PAYMENT_PENDING";
  if (business.kycStatus === "REJECTED") return "REJECTED";
  if (hasAllRequiredKycDocuments(documents)) return "UNDER_REVIEW";
  return "DOCUMENTS_PENDING";
}

function buildKycPayload(
  business: DashboardBusinessRow,
  documents: KycDocumentRow[],
  options: { includeDownloadUrls?: boolean } = {}
): LiveDashboardPayload["kyc"] {
  const hasAllDocuments = hasAllRequiredKycDocuments(documents);
  const status = effectiveKycStatus(business, documents);
  const uploadedDocumentCount = kycDocumentRequirements.filter((requirement) =>
    documents.some((document) => document.type === requirement.type)
  ).length;

  return {
    status,
    label: formatKycStatus(status),
    requiredDocuments: kycDocumentRequirements.map((requirement) => ({ ...requirement })),
    documents: documents.map((document) => mapKycDocument(document, Boolean(options.includeDownloadUrls))),
    requiredDocumentCount: kycDocumentRequirements.length,
    uploadedDocumentCount,
    missingDocumentCount: Math.max(0, kycDocumentRequirements.length - uploadedDocumentCount),
    hasAllDocuments,
    canUpload: business.subscriptionStatus === "ACTIVE" && !business.isVerified,
    readyForReview: business.subscriptionStatus === "ACTIVE" && !business.isVerified && hasAllDocuments,
    submittedAt: business.kycSubmittedAt?.toISOString() ?? null,
    reviewedAt: business.kycReviewedAt?.toISOString() ?? null,
    rejectionReason: business.kycRejectionReason
  };
}

function mapDashboardBusiness(business: DashboardBusinessRow): LiveDashboardPayload["business"] {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    ownerName: business.ownerName,
    email: business.email,
    phone: business.phone,
    address: business.address,
    city: business.city,
    state: business.state,
    logoUrl: getBusinessLogoUrl(business),
    businessType: business.businessType,
    subscriptionPlan: business.subscriptionPlan,
    subscriptionStatus: business.subscriptionStatus,
    kycStatus: business.kycStatus,
    isActive: business.isActive,
    isVerified: business.isVerified,
    isOpen: business.isOpen,
    hours: business.businessHours,
    minimumOrder: Number(business.minimumOrder),
    deliveryFee: Number(business.deliveryFee),
    latitude: business.latitude === null ? null : Number(business.latitude),
    longitude: business.longitude === null ? null : Number(business.longitude),
    serviceRadiusKm: Number(business.serviceRadiusKm),
    fulfillmentModes: fulfillmentModesFromFlags({
      businessType: business.businessType,
      acceptsPickup: business.acceptsPickup,
      acceptsDineIn: business.acceptsDineIn,
      acceptsServiceAtLocation: business.acceptsServiceAtLocation
    }),
    acceptsPickup: business.acceptsPickup,
    acceptsDineIn: business.acceptsDineIn,
    acceptsServiceAtLocation: business.acceptsServiceAtLocation,
    allowsPayLater: business.allowsPayLater,
    paymentUpiId: business.paymentUpiId,
    paymentUpiName: business.paymentUpiName,
    payoutMethod: business.payoutMethod,
    payoutUpiId: business.payoutUpiId,
    payoutUpiName: business.payoutUpiName,
    payoutAccountHolderName: business.payoutAccountHolderName,
    payoutBankName: business.payoutBankName,
    payoutBankAccountNumber: business.payoutBankAccountNumber,
    payoutBankIfsc: business.payoutBankIfsc,
    setupCompletedAt: business.setupCompletedAt?.toISOString() ?? null,
    whatsappDisplayPhone: business.whatsappDisplayPhone,
    whatsappPhoneNumberId: business.whatsappPhoneNumberId,
    whatsappWabaId: business.whatsappWabaId,
    whatsappConnected: business.whatsappConnected,
    whatsappLiveEnabled: business.whatsappLiveEnabled,
    whatsappApprovedAt: business.whatsappApprovedAt?.toISOString() ?? null,
    whatsappAccessTokenConfigured: Boolean(business.whatsappAccessTokenEnc)
  };
}

export async function getDashboardShellPayload(businessId: string): Promise<LiveDashboardPayload> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, include: dashboardBusinessInclude });

  if (!business) {
    throw new LiveDataNotFoundError(`Business ${businessId} was not found for dashboard shell data.`);
  }

  return getEmptyDashboardPayload(mapDashboardBusiness(business));
}

function getBusinessShellPayload(business: DashboardBusinessRow, coupons: BusinessCouponRow[] = []): LiveDashboardPayload {
  return {
    ...getEmptyDashboardPayload(mapDashboardBusiness(business)),
    coupons: coupons.map(mapBusinessCoupon)
  };
}

function buildTopItemsPayload(topOrderItems: TopOrderItemSummary[], bestSellerItems: MenuItemWithCategory[]): LiveTopItem[] {
  return topOrderItems.length > 0
    ? topOrderItems.map((item, index) => {
        const menuItem = bestSellerItems.find((candidate) => candidate.name === item.itemName);
        return {
          id: menuItem?.id ?? `top_${index}_${item.itemName}`,
          name: item.itemName,
          category: menuItem?.category.name ?? "Orders",
          price: menuItem ? Number(menuItem.price) : Number(item._sum?.total ?? 0),
          quantitySold: item._sum?.quantity ?? 0,
          revenue: Number(item._sum?.total ?? 0)
        };
      })
    : bestSellerItems.map((item) => mapMenuItem(item));
}

function buildWalletPayload(walletEntries: WalletEntrySummary[], walletPayouts: WalletPayoutSummary): LiveDashboardPayload["wallet"] {
  const walletAmountForStatus = (status: WalletEntryStatus) =>
    walletEntries
      .filter((entry) => entry.status === status)
      .reduce((sum, entry) => sum + Number(entry._sum?.amount ?? 0), 0);
  const activeCreditEntries = walletEntries.filter((entry) => entry.type === "ORDER_PAYMENT_CREDIT");

  return {
    grossCredited: activeCreditEntries.reduce((sum, entry) => sum + Number(entry._sum?.grossAmount ?? 0), 0),
    platformFees: activeCreditEntries.reduce((sum, entry) => sum + Number(entry._sum?.platformFee ?? 0), 0),
    pendingProviderSettlement: walletAmountForStatus("PENDING_PROVIDER_SETTLEMENT"),
    availableForPayout: walletAmountForStatus("AVAILABLE"),
    processingPayouts: walletAmountForStatus("PROCESSING_PAYOUT"),
    settledCredits: walletAmountForStatus("SETTLED"),
    paidOut: Number(walletPayouts._sum.amount ?? 0)
  };
}

function buildReportPayload({
  reportPayments,
  reportOrders,
  totalCustomers,
  repeatCustomers,
  today,
  currentMonth,
  currentWeek,
  previousWeek
}: {
  reportPayments: ReportPayment[];
  reportOrders: ReportOrder[];
  totalCustomers: number;
  repeatCustomers: number;
  today: Date;
  currentMonth: Date;
  currentWeek: Date;
  previousWeek: Date;
}): LiveDashboardPayload["reports"] {
  const previousWeekEnd = currentWeek;
  const weeklySales = sumPayments(reportPayments, currentWeek);
  const previousWeeklySales = sumPayments(reportPayments, previousWeek, previousWeekEnd);
  const monthlySales = sumPayments(reportPayments, currentMonth);
  const monthlyCompletedPayments = reportPayments.filter((payment) => inRange(payment.createdAt, currentMonth));
  const monthlyOrders = countOrders(reportOrders, currentMonth);
  const weeklyOrders = countOrders(reportOrders, currentWeek);
  const monthlyCustomerOrderCounts = reportOrders
    .filter((order) => inRange(order.createdAt, currentMonth))
    .reduce((counts, order) => {
      counts.set(order.customerId, (counts.get(order.customerId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
  const repeatCustomersThisMonth = Array.from(monthlyCustomerOrderCounts.values()).filter((orderCount) => orderCount > 1).length;

  return {
    dailySales: sumPayments(reportPayments, today),
    dailyOrders: countOrders(reportOrders, today),
    weeklySales,
    weeklyOrders,
    weeklyChangePercent: percentChange(weeklySales, previousWeeklySales),
    monthlySales,
    monthlyOrders,
    repeatOrderRate: monthlyCustomerOrderCounts.size
      ? Math.round((repeatCustomersThisMonth / monthlyCustomerOrderCounts.size) * 100)
      : totalCustomers
        ? Math.round((repeatCustomers / totalCustomers) * 100)
        : 0,
    repeatCustomers: monthlyCustomerOrderCounts.size ? repeatCustomersThisMonth : repeatCustomers,
    totalCustomers: monthlyCustomerOrderCounts.size || totalCustomers,
    averageOrderValue: monthlyCompletedPayments.length ? Math.round(monthlySales / monthlyCompletedPayments.length) : 0,
    completedPayments: monthlyCompletedPayments.length,
    monthlyTrend: buildMonthlyTrend(reportPayments, reportOrders)
  };
}

function buildBillingPayload(business: DashboardBusinessRow, subscriptions: SubscriptionRow[]): LiveDashboardPayload["billing"] {
  const currentSubscription =
    subscriptions.find((subscription) => subscription.plan === business.subscriptionPlan && subscription.status === business.subscriptionStatus) ??
    subscriptions.find((subscription) => subscription.status === "ACTIVE");
  const monthlyAmount = currentSubscription
    ? paidSubscriptionAmount(currentSubscription)
    : subscriptionPlanAmounts[business.subscriptionPlan];

  return {
    plan: business.subscriptionPlan,
    status: business.subscriptionStatus,
    monthlyAmount,
    setupFeeAmount: null,
    currentPeriodStart: currentSubscription?.startDate.toISOString() ?? null,
    currentPeriodEnd: currentSubscription?.endDate.toISOString() ?? null,
    nextRenewalDate: currentSubscription?.endDate.toISOString() ?? null,
    history: subscriptions.filter(isVisibleBillingHistorySubscription).map(mapBillingHistory)
  };
}

function statusCountsFromJson(value: Prisma.JsonValue | null): Record<LiveOrderStatus, number> {
  const counts = emptyOrderStatusCounts();
  if (!value || typeof value !== "object" || Array.isArray(value)) return counts;

  Object.entries(value).forEach(([status, count]) => {
    if (status in counts) {
      counts[status as LiveOrderStatus] = Number(count ?? 0);
    }
  });

  return counts;
}

async function getRecentOrders(businessId: string, limit: number): Promise<LiveOrder[]> {
  const rows = await prisma.$queryRaw<RawRecentOrderRow[]>`
    SELECT
      o."id",
      o."orderNumber",
      o."totalAmount",
      o."status"::text AS "status",
      o."paymentStatus"::text AS "paymentStatus",
      o."orderType"::text AS "orderType",
      o."notes",
      o."createdAt",
      c."name" AS "customerName",
      c."phone" AS "customerPhone",
      c."whatsappOptIn" AS "customerWhatsappOptIn",
      COALESCE(
        jsonb_agg(
          jsonb_build_object('itemName', oi."itemName", 'quantity', oi."quantity")
          ORDER BY oi."id"
        ) FILTER (WHERE oi."id" IS NOT NULL),
        '[]'::jsonb
      ) AS "items"
    FROM "Order" o
    INNER JOIN "Customer" c ON c."id" = o."customerId"
    LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
    WHERE o."businessId" = ${businessId}
    GROUP BY o."id", c."id"
    ORDER BY o."createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map(mapRawRecentOrder);
}

async function getOverviewMetrics(businessId: string, today: Date): Promise<RawOverviewMetricsRow> {
  const rows = await prisma.$queryRaw<RawOverviewMetricsRow[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "Order" WHERE "businessId" = ${businessId} AND "createdAt" >= ${today}) AS "ordersToday",
      (SELECT COALESCE(SUM("amount"), 0) FROM "Payment" WHERE "businessId" = ${businessId} AND "status" = 'COMPLETED'::"PaymentStatus" AND "createdAt" >= ${today}) AS "revenueToday",
      (SELECT COALESCE(SUM("amount"), 0) FROM "Payment" WHERE "businessId" = ${businessId} AND "status" = 'PENDING'::"PaymentStatus") AS "pendingPaymentsAmount",
      (SELECT COUNT(*)::int FROM "Payment" WHERE "businessId" = ${businessId} AND "status" = 'PENDING'::"PaymentStatus") AS "pendingPaymentsCount",
      (SELECT COUNT(*)::int FROM "Customer" WHERE "businessId" = ${businessId} AND "totalOrders" > 1) AS "repeatCustomers",
      (SELECT COUNT(*)::int FROM "Customer" WHERE "businessId" = ${businessId}) AS "totalCustomers",
      COALESCE(
        (
          SELECT jsonb_object_agg(status, total)
          FROM (
            SELECT "status"::text AS status, COUNT(*)::int AS total
            FROM "Order"
            WHERE "businessId" = ${businessId} AND "createdAt" >= ${today}
            GROUP BY "status"
          ) status_rows
        ),
        '{}'::jsonb
      ) AS "statusCounts"
  `;

  return rows[0];
}

async function getOverviewTopItems(businessId: string): Promise<LiveTopItem[]> {
  const rows = await prisma.$queryRaw<RawTopItemRow[]>`
    SELECT
      mi."id",
      oi."itemName" AS "name",
      COALESCE(mc."name", 'Orders') AS "category",
      COALESCE(mi."price", SUM(oi."total")) AS "price",
      SUM(oi."quantity")::int AS "quantitySold",
      SUM(oi."total") AS "revenue"
    FROM "OrderItem" oi
    INNER JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "MenuItem" mi ON mi."businessId" = ${businessId} AND mi."name" = oi."itemName"
    LEFT JOIN "MenuCategory" mc ON mc."id" = mi."categoryId"
    WHERE o."businessId" = ${businessId}
    GROUP BY oi."itemName", mi."id", mi."price", mc."name"
    ORDER BY SUM(oi."quantity") DESC
    LIMIT 4
  `;

  if (rows.length > 0) {
    return rows.map((item, index) => ({
      id: item.id ?? `top_${index}_${item.name}`,
      name: item.name,
      category: item.category ?? "Orders",
      price: Number(item.price ?? 0),
      quantitySold: Number(item.quantitySold ?? 0),
      revenue: Number(item.revenue ?? 0)
    }));
  }

  const bestSellerItems = await prisma.menuItem.findMany({
    where: { businessId },
    orderBy: [{ isBestSeller: "desc" }, { updatedAt: "desc" }],
    take: 4,
    include: { category: true }
  });
  return bestSellerItems.map((item) => mapMenuItem(item));
}

async function getDashboardPaymentRows(businessId: string): Promise<LivePayment[]> {
  const rows = await prisma.$queryRaw<RawPaymentRow[]>`
    SELECT
      p."id",
      p."orderId",
      o."orderNumber",
      o."publicToken",
      c."name" AS "customerName",
      p."amount",
      p."provider"::text AS "provider",
      p."cashfreePaymentId",
      p."cashfreeOrderId",
      p."status"::text AS "status",
      p."paymentRequestUrl",
      p."createdAt",
      w."amount" AS "walletAmount",
      w."status" AS "walletStatus",
      w."platformFee" AS "walletPlatformFee"
    FROM "Payment" p
    INNER JOIN "Order" o ON o."id" = p."orderId"
    INNER JOIN "Customer" c ON c."id" = o."customerId"
    LEFT JOIN "BusinessWalletEntry" w ON w."paymentId" = p."id"
    WHERE p."businessId" = ${businessId}
    ORDER BY p."createdAt" DESC
    LIMIT 80
  `;

  return rows.map(mapRawPayment);
}

async function getDashboardPaymentSummary(businessId: string): Promise<RawPaymentSummaryRow> {
  const rows = await prisma.$queryRaw<RawPaymentSummaryRow[]>`
    SELECT
      (SELECT COALESCE(SUM("amount"), 0) FROM "Payment" WHERE "businessId" = ${businessId} AND "status" = 'PENDING'::"PaymentStatus") AS "pendingPaymentsAmount",
      (SELECT COUNT(*)::int FROM "Payment" WHERE "businessId" = ${businessId} AND "status" = 'PENDING'::"PaymentStatus") AS "pendingPaymentsCount",
      (SELECT COALESCE(SUM("grossAmount"), 0) FROM "BusinessWalletEntry" WHERE "businessId" = ${businessId} AND "type" = 'ORDER_PAYMENT_CREDIT'::"WalletEntryType" AND "status" <> 'CANCELLED'::"WalletEntryStatus") AS "grossCredited",
      (SELECT COALESCE(SUM("platformFee"), 0) FROM "BusinessWalletEntry" WHERE "businessId" = ${businessId} AND "type" = 'ORDER_PAYMENT_CREDIT'::"WalletEntryType" AND "status" <> 'CANCELLED'::"WalletEntryStatus") AS "platformFees",
      (SELECT COALESCE(SUM("amount"), 0) FROM "BusinessWalletEntry" WHERE "businessId" = ${businessId} AND "type" IN ('ORDER_PAYMENT_CREDIT'::"WalletEntryType", 'REFUND_DEBIT'::"WalletEntryType") AND "status" = 'PENDING_PROVIDER_SETTLEMENT'::"WalletEntryStatus") AS "pendingProviderSettlement",
      (SELECT COALESCE(SUM("amount"), 0) FROM "BusinessWalletEntry" WHERE "businessId" = ${businessId} AND "type" IN ('ORDER_PAYMENT_CREDIT'::"WalletEntryType", 'REFUND_DEBIT'::"WalletEntryType") AND "status" = 'AVAILABLE'::"WalletEntryStatus") AS "availableForPayout",
      (SELECT COALESCE(SUM("amount"), 0) FROM "BusinessWalletEntry" WHERE "businessId" = ${businessId} AND "type" IN ('ORDER_PAYMENT_CREDIT'::"WalletEntryType", 'REFUND_DEBIT'::"WalletEntryType") AND "status" = 'PROCESSING_PAYOUT'::"WalletEntryStatus") AS "processingPayouts",
      (SELECT COALESCE(SUM("amount"), 0) FROM "BusinessWalletEntry" WHERE "businessId" = ${businessId} AND "type" IN ('ORDER_PAYMENT_CREDIT'::"WalletEntryType", 'REFUND_DEBIT'::"WalletEntryType") AND "status" = 'SETTLED'::"WalletEntryStatus") AS "settledCredits",
      (SELECT COALESCE(SUM("amount"), 0) FROM "BusinessPayout" WHERE "businessId" = ${businessId} AND "status" = 'PAID'::"BusinessPayoutStatus") AS "paidOut"
  `;

  return rows[0];
}

async function getCustomerCounts(businessId: string): Promise<RawCustomerCountsRow> {
  const rows = await prisma.$queryRaw<RawCustomerCountsRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE "totalOrders" > 1)::int AS "repeatCustomers",
      COUNT(*)::int AS "totalCustomers"
    FROM "Customer"
    WHERE "businessId" = ${businessId}
  `;

  return rows[0];
}

async function getDashboardOrdersScopedPayload(business: DashboardBusinessRow): Promise<LiveDashboardPayload> {
  const mappedOrders = await getRecentOrders(business.id, 80);

  return {
    ...getBusinessShellPayload(business),
    recentOrders: mappedOrders.slice(0, 8),
    orders: mappedOrders
  };
}

async function getDashboardOverviewScopedPayload(business: DashboardBusinessRow): Promise<LiveDashboardPayload> {
  const today = todayStart();
  const [recentOrders, metrics, topItems] = await Promise.all([
    getRecentOrders(business.id, 8),
    getOverviewMetrics(business.id, today),
    getOverviewTopItems(business.id)
  ]);

  return {
    ...getBusinessShellPayload(business),
    metrics: {
      ordersToday: metrics.ordersToday,
      revenueToday: Number(metrics.revenueToday ?? 0),
      pendingPaymentsAmount: Number(metrics.pendingPaymentsAmount ?? 0),
      pendingPaymentsCount: metrics.pendingPaymentsCount,
      repeatCustomers: metrics.repeatCustomers,
      totalCustomers: metrics.totalCustomers,
      repeatRate: metrics.totalCustomers ? Math.round((metrics.repeatCustomers / metrics.totalCustomers) * 100) : 0
    },
    statusCounts: statusCountsFromJson(metrics.statusCounts),
    recentOrders,
    orders: recentOrders,
    topItems
  };
}

async function getDashboardPaymentsScopedPayload(business: DashboardBusinessRow): Promise<LiveDashboardPayload> {
  const [payments, summary] = await Promise.all([
    getDashboardPaymentRows(business.id),
    getDashboardPaymentSummary(business.id)
  ]);
  const payload = getBusinessShellPayload(business);

  return {
    ...payload,
    metrics: {
      ...payload.metrics,
      pendingPaymentsAmount: Number(summary.pendingPaymentsAmount ?? 0),
      pendingPaymentsCount: summary.pendingPaymentsCount
    },
    payments,
    wallet: {
      grossCredited: Number(summary.grossCredited ?? 0),
      platformFees: Number(summary.platformFees ?? 0),
      pendingProviderSettlement: Number(summary.pendingProviderSettlement ?? 0),
      availableForPayout: Number(summary.availableForPayout ?? 0),
      processingPayouts: Number(summary.processingPayouts ?? 0),
      settledCredits: Number(summary.settledCredits ?? 0),
      paidOut: Number(summary.paidOut ?? 0)
    }
  };
}

async function getDashboardInvoicesScopedPayload(
  business: DashboardBusinessRow,
  { includeBilling = true }: { includeBilling?: boolean } = {}
): Promise<LiveDashboardPayload> {
  const [payments, subscriptions] = await Promise.all([
    getDashboardPaymentRows(business.id),
    includeBilling
      ? prisma.subscription.findMany({
          where: { businessId: business.id },
          orderBy: { createdAt: "desc" },
          take: 24
        })
      : Promise.resolve([] as SubscriptionRow[])
  ]);

  return {
    ...getBusinessShellPayload(business),
    payments,
    billing: buildBillingPayload(business, subscriptions)
  };
}

async function getDashboardCustomersScopedPayload(business: DashboardBusinessRow): Promise<LiveDashboardPayload> {
  const [customers, customerCounts] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true,
        name: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
        whatsappOptIn: true,
        marketingOptIn: true
      }
    }),
    getCustomerCounts(business.id)
  ]);
  const payload = getBusinessShellPayload(business);

  return {
    ...payload,
    metrics: {
      ...payload.metrics,
      repeatCustomers: customerCounts.repeatCustomers,
      totalCustomers: customerCounts.totalCustomers,
      repeatRate: customerCounts.totalCustomers ? Math.round((customerCounts.repeatCustomers / customerCounts.totalCustomers) * 100) : 0
    },
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalOrders: customer.totalOrders,
      totalSpent: Number(customer.totalSpent),
      lastOrdered: timeAgo(customer.lastOrderAt),
      favouriteItems: "-",
      whatsappOptIn: customer.whatsappOptIn,
      marketingOptIn: customer.marketingOptIn
    }))
  };
}

async function getDashboardReportsScopedPayload(business: DashboardBusinessRow): Promise<LiveDashboardPayload> {
  const today = todayStart();
  const currentMonth = monthStart();
  const currentWeek = daysAgoStart(6);
  const previousWeek = daysAgoStart(13);
  const trendStart = monthTrendStart();
  const [reportPayments, reportOrders, customerCounts, topItems] = await Promise.all([
    prisma.payment.findMany({
      where: { businessId: business.id, status: "COMPLETED", createdAt: { gte: trendStart } },
      select: { amount: true, createdAt: true }
    }),
    prisma.order.findMany({
      where: { businessId: business.id, createdAt: { gte: trendStart } },
      select: { createdAt: true, customerId: true }
    }),
    getCustomerCounts(business.id),
    getOverviewTopItems(business.id)
  ]);

  return {
    ...getBusinessShellPayload(business),
    reports: buildReportPayload({
      reportPayments,
      reportOrders,
      totalCustomers: customerCounts.totalCustomers,
      repeatCustomers: customerCounts.repeatCustomers,
      today,
      currentMonth,
      currentWeek,
      previousWeek
    }),
    topItems
  };
}

async function getDashboardBillingScopedPayload(business: DashboardBusinessRow): Promise<LiveDashboardPayload> {
  const [subscriptions, kycDocuments] = await Promise.all([
    prisma.subscription.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.businessKycDocument.findMany({
      where: { businessId: business.id },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        businessId: true,
        type: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        uploadedAt: true
      }
    })
  ]);

  return {
    ...getBusinessShellPayload(business),
    billing: buildBillingPayload(business, subscriptions),
    kyc: buildKycPayload(business, kycDocuments)
  };
}

export async function getDashboardLivePayload(
  businessId: string,
  scope: DashboardLiveScope = "full",
  options: { includeBillingInvoices?: boolean } = {}
): Promise<LiveDashboardPayload> {
  const today = todayStart();
  const currentMonth = monthStart();
  const currentWeek = daysAgoStart(6);
  const previousWeek = daysAgoStart(13);
  const trendStart = monthTrendStart();
  const business = await prisma.business.findUnique({ where: { id: businessId }, include: dashboardBusinessInclude });

  if (!business) {
    throw new LiveDataNotFoundError(`Business ${businessId} was not found for dashboard live data.`);
  }

  if (scope === "coupons") {
    const coupons = await prisma.businessCoupon.findMany({
      where: { businessId: business.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    });
    return getBusinessShellPayload(business, coupons);
  }

  if (scope === "settings") {
    return getBusinessShellPayload(business);
  }

  if (scope === "menu" || scope === "campaigns" || scope === "staff") {
    return getBusinessShellPayload(business);
  }

  if (scope === "orders") {
    return getDashboardOrdersScopedPayload(business);
  }

  if (scope === "overview") {
    return getDashboardOverviewScopedPayload(business);
  }

  if (scope === "payments") {
    return getDashboardPaymentsScopedPayload(business);
  }

  if (scope === "invoices") {
    return getDashboardInvoicesScopedPayload(business, { includeBilling: options.includeBillingInvoices ?? true });
  }

  if (scope === "customers") {
    return getDashboardCustomersScopedPayload(business);
  }

  if (scope === "reports") {
    return getDashboardReportsScopedPayload(business);
  }

  if (scope === "billing") {
    return getDashboardBillingScopedPayload(business);
  }

  const [
    orders,
    payments,
    customers,
    walletEntries,
    walletPayouts,
    ordersToday,
    revenueToday,
    pendingPayments,
    repeatCustomers,
    totalCustomers,
    statusGroups,
    topOrderItems,
    bestSellerItems,
    subscriptions,
    kycDocuments,
    coupons,
    reportPayments,
    reportOrders
  ] = await prisma.$transaction([
    prisma.order.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        orderType: true,
        notes: true,
        createdAt: true,
        customer: { select: { name: true, phone: true, whatsappOptIn: true } },
        items: { select: { itemName: true, quantity: true } }
      }
    }),
    prisma.payment.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        orderId: true,
        amount: true,
        provider: true,
        cashfreePaymentId: true,
        cashfreeOrderId: true,
        status: true,
        paymentRequestUrl: true,
        createdAt: true,
        order: { select: { orderNumber: true, publicToken: true, customer: { select: { name: true } } } },
        walletEntry: { select: { amount: true, status: true, platformFee: true } }
      }
    }),
    prisma.customer.findMany({
      where: { businessId },
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        name: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
        whatsappOptIn: true,
        marketingOptIn: true
      }
    }),
    prisma.businessWalletEntry.groupBy({
      by: ["type", "status"],
      where: {
        businessId,
        status: { not: "CANCELLED" },
        type: { in: ["ORDER_PAYMENT_CREDIT", "REFUND_DEBIT"] }
      },
      orderBy: [{ type: "asc" }, { status: "asc" }],
      _sum: { amount: true, grossAmount: true, platformFee: true }
    }),
    prisma.businessPayout.aggregate({
      where: { businessId, status: "PAID" },
      _sum: { amount: true }
    }),
    prisma.order.count({ where: { businessId, createdAt: { gte: today } } }),
    prisma.payment.aggregate({
      where: { businessId, status: "COMPLETED", createdAt: { gte: today } },
      _sum: { amount: true }
    }),
    prisma.payment.aggregate({
      where: { businessId, status: "PENDING" },
      _sum: { amount: true },
      _count: { _all: true }
    }),
    prisma.customer.count({ where: { businessId, totalOrders: { gt: 1 } } }),
    prisma.customer.count({ where: { businessId } }),
    prisma.order.groupBy({
      by: ["status"],
      where: { businessId, createdAt: { gte: today } },
      orderBy: { status: "asc" },
      _count: { _all: true }
    }),
    prisma.orderItem.groupBy({
      by: ["itemName"],
      where: { order: { businessId } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 4
    }),
    prisma.menuItem.findMany({
      where: { businessId },
      orderBy: [{ isBestSeller: "desc" }, { updatedAt: "desc" }],
      take: 4,
      include: { category: true }
    }),
    prisma.subscription.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.businessKycDocument.findMany({
      where: { businessId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        businessId: true,
        type: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        uploadedAt: true
      }
    }),
    prisma.businessCoupon.findMany({
      where: { businessId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    }),
    prisma.payment.findMany({
      where: { businessId, status: "COMPLETED", createdAt: { gte: trendStart } },
      select: { amount: true, createdAt: true }
    }),
    prisma.order.findMany({
      where: { businessId, createdAt: { gte: trendStart } },
      select: { createdAt: true, customerId: true }
    })
  ]);
  const statusCounts = emptyOrderStatusCounts();
  statusGroups.forEach((group) => {
    statusCounts[group.status as LiveOrderStatus] = typeof group._count === "object" ? group._count?._all ?? 0 : 0;
  });
  const reports = buildReportPayload({
    reportPayments,
    reportOrders,
    totalCustomers,
    repeatCustomers,
    today,
    currentMonth,
    currentWeek,
    previousWeek
  });

  return {
    source: "database",
    syncedAt: new Date().toISOString(),
    business: mapDashboardBusiness(business),
    metrics: {
      ordersToday,
      revenueToday: Number(revenueToday._sum.amount ?? 0),
      pendingPaymentsAmount: Number(pendingPayments._sum.amount ?? 0),
      pendingPaymentsCount: pendingPayments._count._all,
      repeatCustomers,
      totalCustomers,
      repeatRate: totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0
    },
    statusCounts,
    recentOrders: orders.slice(0, 8).map(mapOrder),
    orders: orders.map(mapOrder),
    payments: payments.map(mapPayment),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalOrders: customer.totalOrders,
      totalSpent: Number(customer.totalSpent),
      lastOrdered: timeAgo(customer.lastOrderAt),
      favouriteItems: "-",
      whatsappOptIn: customer.whatsappOptIn,
      marketingOptIn: customer.marketingOptIn
    })),
    topItems: buildTopItemsPayload(topOrderItems, bestSellerItems),
    coupons: coupons.map(mapBusinessCoupon),
    reports,
    billing: buildBillingPayload(business, subscriptions),
    kyc: buildKycPayload(business, kycDocuments),
    wallet: buildWalletPayload(walletEntries, walletPayouts)
  };
}

function businessStatus(isActive: boolean, isVerified: boolean, subscriptionStatus: SubscriptionStatus, kycStatus: LiveKycStatus) {
  if (!isVerified) {
    if (subscriptionStatus !== "ACTIVE" || kycStatus === "PAYMENT_PENDING") return "Payment Pending";
    if (kycStatus === "DOCUMENTS_PENDING") return "Docs Pending";
    if (kycStatus === "REJECTED") return "KYC Rejected";
    return "Pending Approval";
  }
  if (!isActive) return "Suspended";
  if (subscriptionStatus === "TRIAL") return "Trial";
  if (subscriptionStatus === "PAST_DUE") return "PENDING";
  if (subscriptionStatus === "CANCELLED") return "Inactive";
  return "Active";
}

export async function getAdminLivePayload(): Promise<LiveAdminPayload> {
  const now = new Date();
  const today = todayStart();
  const recent = sevenDaysAgo();
  const [
    businesses,
    activeBusinesses,
    currentSubscriptionRows,
    recentSubscriptionRows,
    pendingSubscriptionPayments,
    ordersToday,
    paymentFailures,
    whatsappMessagesSent,
    newSignups7d,
    churnedBusinesses,
    revenueByBusiness,
    walletCreditsByBusiness,
    walletPayoutsByBusiness,
    recentAuditLogs,
    recentWhatsappLogs,
    recentPaymentRows
  ] = await prisma.$transaction([
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        ...dashboardBusinessInclude,
        _count: { select: { orders: true, customers: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        kycDocuments: {
          orderBy: { uploadedAt: "desc" },
          select: {
            id: true,
            businessId: true,
            type: true,
            fileName: true,
            contentType: true,
            fileSize: true,
            uploadedAt: true
          }
        }
      }
    }),
    prisma.business.count({ where: { isActive: true, isVerified: true, subscriptionStatus: "ACTIVE", kycStatus: "APPROVED" } }),
    prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        paymentStatus: "COMPLETED",
        endDate: { gt: now }
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      select: adminSubscriptionSelect
    }),
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: adminSubscriptionSelect
    }),
    prisma.subscription.count({ where: { paymentStatus: "PENDING" } }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: today } } }),
    prisma.whatsappMessage.count({ where: { status: { in: ["SENT", "DELIVERED"] } } }),
    prisma.business.count({ where: { createdAt: { gte: recent } } }),
    prisma.business.count({ where: { subscriptionStatus: "CANCELLED" } }),
    prisma.payment.groupBy({
      by: ["businessId"],
      where: { status: "COMPLETED" },
      orderBy: { businessId: "asc" },
      _sum: { amount: true }
    }),
    prisma.businessWalletEntry.groupBy({
      by: ["businessId", "type", "status"],
      where: {
        status: { not: "CANCELLED" },
        type: { in: ["ORDER_PAYMENT_CREDIT", "REFUND_DEBIT"] }
      },
      orderBy: [{ businessId: "asc" }, { type: "asc" }, { status: "asc" }],
      _sum: { amount: true, grossAmount: true, platformFee: true }
    }),
    prisma.businessPayout.groupBy({
      by: ["businessId"],
      where: { status: "PAID" },
      orderBy: { businessId: "asc" },
      _sum: { amount: true }
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: adminAuditLogSelect
    }),
    prisma.whatsappMessage.findMany({
      orderBy: [{ failedAt: "desc" }, { deliveredAt: "desc" }, { sentAt: "desc" }],
      take: 80,
      select: adminWhatsappLogSelect
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: adminPaymentLogSelect
    })
  ]);

  const revenueMap = new Map(revenueByBusiness.map((item) => [item.businessId, Number(item._sum?.amount ?? 0)]));
  const paidOutMap = new Map(walletPayoutsByBusiness.map((item) => [item.businessId, Number(item._sum?.amount ?? 0)]));
  const walletRowsForBusiness = (businessId: string) => walletCreditsByBusiness.filter((item) => item.businessId === businessId);
  const walletAmountForStatus = (businessId: string, status: string) =>
    walletRowsForBusiness(businessId)
      .filter((item) => item.status === status)
      .reduce((sum, item) => sum + Number(item._sum?.amount ?? 0), 0);
  const walletGrossForBusiness = (businessId: string) =>
    walletRowsForBusiness(businessId)
      .filter((item) => item.type === "ORDER_PAYMENT_CREDIT")
      .reduce((sum, item) => sum + Number(item._sum?.grossAmount ?? 0), 0);
  const walletFeesForBusiness = (businessId: string) =>
    walletRowsForBusiness(businessId)
      .filter((item) => item.type === "ORDER_PAYMENT_CREDIT")
      .reduce((sum, item) => sum + Number(item._sum?.platformFee ?? 0), 0);
  const currentSubscriptionsByBusiness = new Map<string, AdminSubscriptionRow>();
  currentSubscriptionRows.forEach((subscription) => {
    if (!currentSubscriptionsByBusiness.has(subscription.businessId)) {
      currentSubscriptionsByBusiness.set(subscription.businessId, subscription);
    }
  });
  const currentSubscriptions = Array.from(currentSubscriptionsByBusiness.values());
  const liveBusinesses: LiveAdminBusiness[] = businesses.map((business) => {
    const kycPayload = buildKycPayload(business, business.kycDocuments, { includeDownloadUrls: true });

    return {
      id: business.id,
      name: business.name,
      phone: business.phone,
      address: business.address,
      city: business.city,
      state: business.state,
      plan: formatSubscriptionPlan(business.subscriptionPlan),
      currentSubscriptionAmount: paidSubscriptionAmount(currentSubscriptionsByBusiness.get(business.id)),
      subscriptionStatus: business.subscriptionStatus,
      status: businessStatus(business.isActive, business.isVerified, business.subscriptionStatus, kycPayload.status),
      businessType: business.businessType,
      isOpen: business.isOpen,
      serviceVisitFee: Number(business.deliveryFee),
      latitude: business.latitude === null ? null : Number(business.latitude),
      longitude: business.longitude === null ? null : Number(business.longitude),
      serviceRadiusKm: Number(business.serviceRadiusKm),
      fulfillmentModes: fulfillmentModesFromFlags({
        businessType: business.businessType,
        acceptsPickup: business.acceptsPickup,
        acceptsDineIn: business.acceptsDineIn,
        acceptsServiceAtLocation: business.acceptsServiceAtLocation
      }),
      acceptsPickup: business.acceptsPickup,
      acceptsDineIn: business.acceptsDineIn,
      acceptsServiceAtLocation: business.acceptsServiceAtLocation,
      payoutMethod: business.payoutMethod,
      payoutUpiId: business.payoutUpiId,
      payoutUpiName: business.payoutUpiName,
      payoutAccountHolderName: business.payoutAccountHolderName,
      payoutBankName: business.payoutBankName,
      payoutBankAccountNumber: business.payoutBankAccountNumber,
      payoutBankIfsc: business.payoutBankIfsc,
      setupCompletedAt: business.setupCompletedAt?.toISOString() ?? null,
      whatsappDisplayPhone: business.whatsappDisplayPhone,
      whatsappPhoneNumberId: business.whatsappPhoneNumberId,
      whatsappWabaId: business.whatsappWabaId,
      whatsappConnected: business.whatsappConnected,
      whatsappLiveEnabled: business.whatsappLiveEnabled,
      whatsappApprovedAt: business.whatsappApprovedAt?.toISOString() ?? null,
      whatsappAccessTokenConfigured: Boolean(business.whatsappAccessTokenEnc),
      cashfreeVendorId: business.cashfreeVendorId,
      cashfreeSplitEnabled: business.cashfreeSplitEnabled,
      platformFeeBps: business.platformFeeBps,
      walletGrossCredited: walletGrossForBusiness(business.id),
      walletPlatformFees: walletFeesForBusiness(business.id),
      walletPendingProviderSettlement: walletAmountForStatus(business.id, "PENDING_PROVIDER_SETTLEMENT"),
      walletAvailableForPayout: walletAmountForStatus(business.id, "AVAILABLE"),
      walletProcessingPayouts: walletAmountForStatus(business.id, "PROCESSING_PAYOUT"),
      walletSettledCredits: walletAmountForStatus(business.id, "SETTLED"),
      walletPaidOut: paidOutMap.get(business.id) ?? 0,
      revenue: revenueMap.get(business.id) ?? 0,
      orders: business._count.orders,
      customers: business._count.customers,
      kyc: kycPayload.label,
      kycStatus: kycPayload.status,
      kycDocuments: kycPayload.documents,
      kycRequiredDocumentCount: kycPayload.requiredDocumentCount,
      kycUploadedDocumentCount: kycPayload.uploadedDocumentCount,
      kycMissingDocumentCount: kycPayload.missingDocumentCount,
      kycReadyForApproval: kycPayload.readyForReview,
      kycSubmittedAt: kycPayload.submittedAt,
      kycReviewedAt: kycPayload.reviewedAt,
      kycRejectionReason: kycPayload.rejectionReason,
      createdAt: business.createdAt.toISOString()
    };
  });

  const subscriptionPlanCounts: Record<LiveSubscriptionPlan, number> = { STARTER: 0, PRO: 0 };
  currentSubscriptions.forEach((subscription) => {
    subscriptionPlanCounts[subscription.plan as LiveSubscriptionPlan] += 1;
  });
  const monthlyRecurringRevenue = sumPaidSubscriptionAmounts(currentSubscriptions);
  const auditLogs = sortAdminLogs(recentAuditLogs.map(mapAdminAuditLog)).slice(0, 60);
  const whatsappLogs = sortAdminLogs(recentWhatsappLogs.map(mapAdminWhatsappLog)).slice(0, 60);
  const paymentLogs = sortAdminLogs([
    ...recentPaymentRows.map(mapAdminPaymentLog),
    ...recentSubscriptionRows.map(mapAdminSubscriptionPaymentLog)
  ]).slice(0, 80);

  return {
    source: "database",
    syncedAt: new Date().toISOString(),
    metrics: {
      totalBusinesses: businesses.length,
      activeBusinesses,
      activeSubscriptions: currentSubscriptions.length,
      monthlyRecurringRevenue,
      pendingSubscriptionPayments,
      subscriptionPlanCounts,
      ordersToday,
      paymentFailures,
      whatsappMessagesSent,
      newSignups7d,
      churnedBusinesses,
      pendingBusinessPayouts: liveBusinesses.reduce((sum, business) => sum + business.walletAvailableForPayout, 0)
    },
    businesses: liveBusinesses,
    subscriptions: recentSubscriptionRows.map(mapAdminSubscription),
    auditLogs,
    whatsappLogs,
    paymentLogs
  };
}

export function dashboardLiveChangeMatches(businessId: string, scope: DashboardLiveScope, change: LiveChangePayload) {
  const relevantTables = dashboardScopeTables[scope] ?? dashboardScopeTables.full;
  if (!relevantTables.has(change.table)) return false;
  if (change.global) return true;
  if (!businessScopedTables.has(change.table)) return false;
  return change.businessId === businessId;
}

export function adminLiveChangeMatches(change: LiveChangePayload) {
  return adminTables.has(change.table) || Boolean(change.global);
}

export function liveStream(
  payloadName: string,
  getPayload: () => Promise<unknown>,
  signal: AbortSignal,
  options: {
    sendInitialPayload?: boolean;
    refreshIntervalMs?: number;
    debounceMs?: number;
    changeFilter?: (change: LiveChangePayload) => boolean;
  } = {}
) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let isSending = false;
  let closed = false;
  const sendInitialPayload = options.sendInitialPayload ?? true;
  const refreshIntervalMs = options.refreshIntervalMs ?? LIVE_STREAM_REFRESH_INTERVAL_MS;
  const debounceMs = options.debounceMs ?? 250;

  return new ReadableStream({
    async start(controller) {
      function enqueueEvent(name: string, data: unknown) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      async function sendPayload() {
        if (closed || isSending) return;
        isSending = true;

        try {
          const payload = await getPayload();
          enqueueEvent(payloadName, payload);
        } catch {
          enqueueEvent("sync-error", {});
        } finally {
          isSending = false;
        }
      }

      function queuePayload() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void sendPayload(), debounceMs);
      }

      function cleanup() {
        closed = true;
        if (timer) clearInterval(timer);
        if (debounceTimer) clearTimeout(debounceTimer);
        unsubscribe?.();
      }

      enqueueEvent("live-ready", {});
      if (sendInitialPayload) {
        await sendPayload();
      }
      if (options.changeFilter) {
        unsubscribe = subscribeToLiveChanges((change) => {
          if (options.changeFilter?.(change)) queuePayload();
        });
      }
      timer = setInterval(sendPayload, refreshIntervalMs);

      signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe?.();
      closed = true;
    }
  });
}
