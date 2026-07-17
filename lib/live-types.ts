import { demoBusinesses, demoCustomers, demoOrders, demoPayments, platformBusinesses } from "@/lib/demo-data";
import type { ActiveFulfillmentMode } from "@/lib/business-rules";
import { subscriptionPlanAmounts } from "@/lib/billing";
import { kycDocumentRequirements, formatKycStatus } from "@/lib/kyc";

export const orderStatuses = ["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"] as const;
export const paymentStatuses = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] as const;

export type LiveSource = "database" | "demo";
export type LiveOrderStatus = (typeof orderStatuses)[number];
export type LivePaymentStatus = (typeof paymentStatuses)[number];
export type LiveSubscriptionPlan = "STARTER" | "PRO";
export type LiveSubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
export type LiveKycStatus = "PAYMENT_PENDING" | "DOCUMENTS_PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export type LiveKycDocumentType = "BUSINESS_REGISTRATION" | "OWNER_ID" | "ADDRESS_PROOF" | "BANK_PROOF";

export type LiveOrder = {
  id: string;
  orderNumber: string;
  customer: string;
  customerPhone: string;
  items: string;
  itemCount: number;
  amount: number;
  status: LiveOrderStatus;
  paymentStatus: LivePaymentStatus;
  channel: string;
  time: string;
  createdAt: string;
  scheduledFor: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  noShowAt: string | null;
  orderType: "PICKUP" | "DELIVERY" | "DINE_IN" | "SERVICE_AT_LOCATION";
  notes: string | null;
};

export type LivePayment = {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  amount: number;
  provider: string;
  paymentId: string;
  status: LivePaymentStatus;
  walletAmount: number;
  walletStatus: string;
  platformFee: number;
  linkStatus: string;
  refundStatus: string;
  invoiceUrl: string;
  canMarkPaid: boolean;
  createdAt: string;
};

export type LiveCustomer = {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastOrdered: string;
  favouriteItems: string;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
};

export type LiveTopItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantitySold: number;
  revenue: number;
};

export type LiveBusinessCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minimumOrderAmount: number;
  redemptionLimit: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type LiveReportTrendPoint = {
  label: string;
  revenue: number;
  orders: number;
};

export type LiveReportPayload = {
  dailySales: number;
  dailyOrders: number;
  weeklySales: number;
  weeklyOrders: number;
  weeklyChangePercent: number;
  monthlySales: number;
  monthlyOrders: number;
  repeatOrderRate: number;
  repeatCustomers: number;
  totalCustomers: number;
  averageOrderValue: number;
  completedPayments: number;
  monthlyTrend: LiveReportTrendPoint[];
};

export type LiveBillingHistoryItem = {
  id: string;
  label: string;
  amount: number;
  status: LiveSubscriptionStatus | "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  reference: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  invoiceUrl: string;
};

export type LiveBillingPayload = {
  plan: LiveSubscriptionPlan;
  status: LiveSubscriptionStatus;
  monthlyAmount: number;
  setupFeeAmount: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextRenewalDate: string | null;
  history: LiveBillingHistoryItem[];
};

export type LiveKycDocumentRequirement = {
  type: LiveKycDocumentType;
  label: string;
  description: string;
};

export type LiveKycDocument = {
  id: string;
  type: LiveKycDocumentType;
  label: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  downloadUrl?: string;
};

export type LiveKycPayload = {
  status: LiveKycStatus;
  label: string;
  requiredDocuments: LiveKycDocumentRequirement[];
  documents: LiveKycDocument[];
  requiredDocumentCount: number;
  uploadedDocumentCount: number;
  missingDocumentCount: number;
  hasAllDocuments: boolean;
  canUpload: boolean;
  readyForReview: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type LiveWalletPayload = {
  grossCredited: number;
  platformFees: number;
  pendingProviderSettlement: number;
  availableForPayout: number;
  processingPayouts: number;
  settledCredits: number;
  paidOut: number;
};

export type LiveDashboardPayload = {
  source: LiveSource;
  syncedAt: string;
  business: {
    id: string;
    name: string;
    slug: string;
    ownerName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    logoUrl: string | null;
    businessType: string;
    subscriptionPlan: LiveSubscriptionPlan;
    subscriptionStatus: LiveSubscriptionStatus;
    kycStatus: LiveKycStatus;
    isActive: boolean;
    isVerified: boolean;
    isOpen: boolean;
    hours: string;
    minimumOrder: number;
    deliveryFee: number;
    latitude: number | null;
    longitude: number | null;
    serviceRadiusKm: number;
    fulfillmentModes: ActiveFulfillmentMode[];
    acceptsPickup: boolean;
    acceptsDineIn: boolean;
    acceptsServiceAtLocation: boolean;
    allowsPayLater: boolean;
    paymentUpiId: string | null;
    paymentUpiName: string | null;
    payoutMethod: "UPI" | "BANK_TRANSFER";
    payoutUpiId: string | null;
    payoutUpiName: string | null;
    payoutAccountHolderName: string | null;
    payoutBankName: string | null;
    payoutBankAccountNumber: string | null;
    payoutBankIfsc: string | null;
    setupCompletedAt: string | null;
    whatsappDisplayPhone: string | null;
    whatsappPhoneNumberId: string | null;
    whatsappWabaId: string | null;
    whatsappConnected: boolean;
    whatsappLiveEnabled: boolean;
    whatsappApprovedAt: string | null;
    whatsappAccessTokenConfigured: boolean;
  };
  metrics: {
    ordersToday: number;
    revenueToday: number;
    pendingPaymentsAmount: number;
    pendingPaymentsCount: number;
    repeatCustomers: number;
    totalCustomers: number;
    repeatRate: number;
  };
  statusCounts: Record<LiveOrderStatus, number>;
  recentOrders: LiveOrder[];
  orders: LiveOrder[];
  payments: LivePayment[];
  customers: LiveCustomer[];
  topItems: LiveTopItem[];
  coupons: LiveBusinessCoupon[];
  reports: LiveReportPayload;
  billing: LiveBillingPayload;
  kyc: LiveKycPayload;
  wallet: LiveWalletPayload;
};

export type LiveAdminBusiness = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  plan: string;
  currentSubscriptionAmount: number;
  subscriptionStatus: LiveSubscriptionStatus;
  status: string;
  businessType: string;
  isOpen: boolean;
  serviceVisitFee: number;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number;
  fulfillmentModes: ActiveFulfillmentMode[];
  acceptsPickup: boolean;
  acceptsDineIn: boolean;
  acceptsServiceAtLocation: boolean;
  payoutMethod: "UPI" | "BANK_TRANSFER";
  payoutUpiId: string | null;
  payoutUpiName: string | null;
  payoutAccountHolderName: string | null;
  payoutBankName: string | null;
  payoutBankAccountNumber: string | null;
  payoutBankIfsc: string | null;
  setupCompletedAt: string | null;
  whatsappDisplayPhone: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappWabaId: string | null;
  whatsappConnected: boolean;
  whatsappLiveEnabled: boolean;
  whatsappApprovedAt: string | null;
  whatsappAccessTokenConfigured: boolean;
  cashfreeVendorId: string | null;
  cashfreeSplitEnabled: boolean;
  platformFeeBps: number;
  walletGrossCredited: number;
  walletPlatformFees: number;
  walletPendingProviderSettlement: number;
  walletAvailableForPayout: number;
  walletProcessingPayouts: number;
  walletSettledCredits: number;
  walletPaidOut: number;
  revenue: number;
  orders: number;
  customers: number;
  kyc: string;
  kycStatus: LiveKycStatus;
  kycDocuments: LiveKycDocument[];
  kycRequiredDocumentCount: number;
  kycUploadedDocumentCount: number;
  kycMissingDocumentCount: number;
  kycReadyForApproval: boolean;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectionReason: string | null;
  createdAt: string;
};

export type LiveAdminSubscription = {
  id: string;
  reference: string;
  invoiceUrl: string;
  businessId: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  plan: LiveSubscriptionPlan;
  amount: number;
  status: LiveSubscriptionStatus;
  paymentState: LivePaymentStatus;
  paymentProvider: string;
  paymentProviderLabel: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type LiveAdminLogSource = "audit" | "whatsapp" | "payment";
export type LiveAdminLogStatus = "ACTIVE" | "PENDING" | "COMPLETED" | "FAILED" | "QUEUED" | "SENT" | "DELIVERED";

export type LiveAdminLog = {
  id: string;
  source: LiveAdminLogSource;
  action: string;
  entity: string;
  status: LiveAdminLogStatus;
  businessId: string | null;
  businessName: string;
  actorName: string | null;
  summary: string;
  detail: string | null;
  reference: string | null;
  occurredAt: string | null;
};

export type LiveAdminPayload = {
  source: LiveSource;
  syncedAt: string;
  metrics: {
    totalBusinesses: number;
    activeBusinesses: number;
    activeSubscriptions: number;
    monthlyRecurringRevenue: number;
    pendingSubscriptionPayments: number;
    subscriptionPlanCounts: Record<LiveSubscriptionPlan, number>;
    ordersToday: number;
    paymentFailures: number;
    whatsappMessagesSent: number;
    newSignups7d: number;
    churnedBusinesses: number;
    pendingBusinessPayouts: number;
  };
  businesses: LiveAdminBusiness[];
  subscriptions: LiveAdminSubscription[];
  auditLogs: LiveAdminLog[];
  whatsappLogs: LiveAdminLog[];
  paymentLogs: LiveAdminLog[];
};

export function emptyOrderStatusCounts() {
  return orderStatuses.reduce(
    (counts, status) => ({ ...counts, [status]: 0 }),
    {} as Record<LiveOrderStatus, number>
  );
}

export function getEmptyDashboardPayload(
  business: Partial<LiveDashboardPayload["business"]> = {}
): LiveDashboardPayload {
  return {
    source: "database",
    syncedAt: new Date().toISOString(),
    business: {
      id: business.id ?? "",
      name: business.name ?? "",
      slug: business.slug ?? "",
      ownerName: business.ownerName ?? "",
      email: business.email ?? "",
      phone: business.phone ?? "",
      address: business.address ?? "",
      city: business.city ?? "",
      state: business.state ?? "",
      logoUrl: business.logoUrl ?? null,
      businessType: business.businessType ?? "",
      subscriptionPlan: business.subscriptionPlan ?? "STARTER",
      subscriptionStatus: business.subscriptionStatus ?? "TRIAL",
      kycStatus: business.kycStatus ?? "PAYMENT_PENDING",
      isActive: business.isActive ?? false,
      isVerified: business.isVerified ?? false,
      isOpen: business.isOpen ?? true,
      hours: business.hours ?? "",
      minimumOrder: business.minimumOrder ?? 0,
      deliveryFee: business.deliveryFee ?? 0,
      latitude: business.latitude ?? null,
      longitude: business.longitude ?? null,
      serviceRadiusKm: business.serviceRadiusKm ?? 0,
      fulfillmentModes: business.fulfillmentModes ?? ["PICKUP"],
      acceptsPickup: business.acceptsPickup ?? true,
      acceptsDineIn: business.acceptsDineIn ?? true,
      acceptsServiceAtLocation: business.acceptsServiceAtLocation ?? false,
      allowsPayLater: business.allowsPayLater ?? true,
      paymentUpiId: business.paymentUpiId ?? null,
      paymentUpiName: business.paymentUpiName ?? null,
      payoutMethod: business.payoutMethod ?? "UPI",
      payoutUpiId: business.payoutUpiId ?? null,
      payoutUpiName: business.payoutUpiName ?? null,
      payoutAccountHolderName: business.payoutAccountHolderName ?? null,
      payoutBankName: business.payoutBankName ?? null,
      payoutBankAccountNumber: business.payoutBankAccountNumber ?? null,
      payoutBankIfsc: business.payoutBankIfsc ?? null,
      setupCompletedAt: business.setupCompletedAt ?? null,
      whatsappDisplayPhone: business.whatsappDisplayPhone ?? null,
      whatsappPhoneNumberId: business.whatsappPhoneNumberId ?? null,
      whatsappWabaId: business.whatsappWabaId ?? null,
      whatsappConnected: business.whatsappConnected ?? false,
      whatsappLiveEnabled: business.whatsappLiveEnabled ?? false,
      whatsappApprovedAt: business.whatsappApprovedAt ?? null,
      whatsappAccessTokenConfigured: business.whatsappAccessTokenConfigured ?? false
    },
    metrics: {
      ordersToday: 0,
      revenueToday: 0,
      pendingPaymentsAmount: 0,
      pendingPaymentsCount: 0,
      repeatCustomers: 0,
      totalCustomers: 0,
      repeatRate: 0
    },
    statusCounts: emptyOrderStatusCounts(),
    recentOrders: [],
    orders: [],
    payments: [],
    customers: [],
    topItems: [],
    coupons: [],
    reports: {
      dailySales: 0,
      dailyOrders: 0,
      weeklySales: 0,
      weeklyOrders: 0,
      weeklyChangePercent: 0,
      monthlySales: 0,
      monthlyOrders: 0,
      repeatOrderRate: 0,
      repeatCustomers: 0,
      totalCustomers: 0,
      averageOrderValue: 0,
      completedPayments: 0,
      monthlyTrend: []
    },
    billing: {
      plan: business.subscriptionPlan ?? "STARTER",
      status: business.subscriptionStatus ?? "TRIAL",
      monthlyAmount: 0,
      setupFeeAmount: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      nextRenewalDate: null,
      history: []
    },
    kyc: {
      status: business.kycStatus ?? "PAYMENT_PENDING",
      label: formatKycStatus(business.kycStatus ?? "PAYMENT_PENDING"),
      requiredDocuments: kycDocumentRequirements.map((requirement) => ({ ...requirement })),
      documents: [],
      requiredDocumentCount: kycDocumentRequirements.length,
      uploadedDocumentCount: 0,
      missingDocumentCount: kycDocumentRequirements.length,
      hasAllDocuments: false,
      canUpload: false,
      readyForReview: false,
      submittedAt: null,
      reviewedAt: null,
      rejectionReason: null
    },
    wallet: {
      grossCredited: 0,
      platformFees: 0,
      pendingProviderSettlement: 0,
      availableForPayout: 0,
      processingPayouts: 0,
      settledCredits: 0,
      paidOut: 0
    }
  };
}

export function getEmptyAdminPayload(): LiveAdminPayload {
  return {
    source: "database",
    syncedAt: new Date().toISOString(),
    metrics: {
      totalBusinesses: 0,
      activeBusinesses: 0,
      activeSubscriptions: 0,
      monthlyRecurringRevenue: 0,
      pendingSubscriptionPayments: 0,
      subscriptionPlanCounts: { STARTER: 0, PRO: 0 },
      ordersToday: 0,
      paymentFailures: 0,
      whatsappMessagesSent: 0,
      newSignups7d: 0,
      churnedBusinesses: 0,
      pendingBusinessPayouts: 0
    },
    businesses: [],
    subscriptions: [],
    auditLogs: [],
    whatsappLogs: [],
    paymentLogs: []
  };
}

function demoOrderStatus(status: string): LiveOrderStatus {
  return orderStatuses.includes(status as LiveOrderStatus) ? (status as LiveOrderStatus) : "NEW";
}

function demoPaymentStatus(status: string): LivePaymentStatus {
  return paymentStatuses.includes(status as LivePaymentStatus) ? (status as LivePaymentStatus) : "PENDING";
}

export function getDemoDashboardPayload(): LiveDashboardPayload {
  const business = demoBusinesses[0];
  const orders = demoOrders.map((order): LiveOrder => ({
    id: order.id,
    orderNumber: order.id,
    customer: order.customer,
    customerPhone: "",
    items: order.items,
    itemCount: Number(order.items.match(/x(\d+)/)?.[1] ?? 1),
    amount: order.amount,
    status: demoOrderStatus(order.status),
    paymentStatus: demoPaymentStatus(order.paymentStatus),
    channel: order.channel,
    time: order.time,
    createdAt: new Date().toISOString(),
    scheduledFor: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    noShowAt: null,
    orderType: "PICKUP",
    notes: null
  }));
  const payments = demoPayments.map((payment, index): LivePayment => ({
    id: `demo_payment_${index}`,
    orderId: payment.orderId,
    orderNumber: payment.orderId,
    customer: payment.customer,
    amount: payment.amount,
    provider: payment.provider,
    paymentId: payment.paymentId,
    status: demoPaymentStatus(payment.status),
    walletAmount: demoPaymentStatus(payment.status) === "COMPLETED" && payment.provider === "Cashfree" ? payment.amount : 0,
    walletStatus: demoPaymentStatus(payment.status) === "COMPLETED" && payment.provider === "Cashfree" ? "Available" : "Not walleted",
    platformFee: 0,
    linkStatus: payment.linkStatus,
    refundStatus: payment.refundStatus,
    invoiceUrl: "#",
    canMarkPaid: ["CASH", "UPI", "Business UPI"].includes(payment.provider) && demoPaymentStatus(payment.status) === "PENDING",
    createdAt: new Date().toISOString()
  }));
  const customers = demoCustomers.map((customer, index): LiveCustomer => ({
    id: `demo_customer_${index}`,
    ...customer
  }));
  const statusCounts = emptyOrderStatusCounts();
  orders.forEach((order) => {
    statusCounts[order.status] += 1;
  });
  const repeatCustomers = customers.filter((customer) => customer.totalOrders > 1).length;
  const pendingPayments = payments.filter((payment) => payment.status === "PENDING");
  const completedPayments = payments.filter((payment) => payment.status === "COMPLETED");
  const monthlyTrend = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(
    (label, index) => ({
      label,
      revenue: [42000, 56000, 52000, 66000, 72000, 69000, 84000, 79000, 91000, 104000, 98800, 124800][index],
      orders: [110, 142, 136, 166, 184, 174, 214, 202, 235, 270, 248, 322][index]
    })
  );

  return {
    source: "demo",
    syncedAt: new Date().toISOString(),
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      ownerName: business.ownerName,
      email: business.email,
      phone: business.phone,
      address: business.address,
      city: business.city,
      state: business.state,
      logoUrl: null,
      businessType: business.businessType,
      subscriptionPlan: "STARTER",
      subscriptionStatus: "TRIAL",
      kycStatus: "APPROVED",
      isActive: true,
      isVerified: true,
      isOpen: business.open,
      hours: business.hours,
      minimumOrder: business.minimumOrder,
      deliveryFee: business.deliveryFee,
      latitude: business.latitude,
      longitude: business.longitude,
      serviceRadiusKm: business.serviceRadiusKm,
      fulfillmentModes: business.fulfillmentModes,
      acceptsPickup: business.fulfillmentModes.includes("PICKUP"),
      acceptsDineIn: business.fulfillmentModes.includes("DINE_IN"),
      acceptsServiceAtLocation: business.fulfillmentModes.includes("SERVICE_AT_LOCATION"),
      allowsPayLater: business.allowsPayOnDelivery,
      paymentUpiId: null,
      paymentUpiName: null,
      payoutMethod: "UPI",
      payoutUpiId: "demo@bank",
      payoutUpiName: business.ownerName,
      payoutAccountHolderName: business.ownerName,
      payoutBankName: null,
      payoutBankAccountNumber: null,
      payoutBankIfsc: null,
      setupCompletedAt: new Date().toISOString(),
      whatsappDisplayPhone: business.phone,
      whatsappPhoneNumberId: "demo_phone_number_sri_sai",
      whatsappWabaId: "demo_waba_sri_sai",
      whatsappConnected: true,
      whatsappLiveEnabled: false,
      whatsappApprovedAt: null,
      whatsappAccessTokenConfigured: false
    },
    metrics: {
      ordersToday: orders.length,
      revenueToday: payments
        .filter((payment) => payment.status === "COMPLETED")
        .reduce((sum, payment) => sum + payment.amount, 0),
      pendingPaymentsAmount: pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
      pendingPaymentsCount: pendingPayments.length,
      repeatCustomers,
      totalCustomers: customers.length,
      repeatRate: customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0
    },
    statusCounts,
    recentOrders: orders,
    orders,
    payments,
    customers,
    topItems: business.menu.slice(0, 4).map((item, index) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      quantitySold: Math.max(1, 12 - index * 2),
      revenue: item.price * Math.max(1, 12 - index * 2)
    })),
    coupons: [],
    reports: {
      dailySales: completedPayments.reduce((sum, payment) => sum + payment.amount, 0),
      dailyOrders: orders.length,
      weeklySales: 124800,
      weeklyOrders: 322,
      weeklyChangePercent: 18,
      monthlySales: 386000,
      monthlyOrders: 1008,
      repeatOrderRate: customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0,
      repeatCustomers,
      totalCustomers: customers.length,
      averageOrderValue: completedPayments.length
        ? Math.round(completedPayments.reduce((sum, payment) => sum + payment.amount, 0) / completedPayments.length)
        : 0,
      completedPayments: completedPayments.length,
      monthlyTrend
    },
    billing: {
      plan: "STARTER",
      status: "TRIAL",
      monthlyAmount: subscriptionPlanAmounts.STARTER,
      setupFeeAmount: null,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      nextRenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      history: [
        {
          id: "demo_subscription_current",
          label: "June 2026",
          amount: subscriptionPlanAmounts.STARTER,
          status: "TRIAL",
          reference: "SUB-DEMO",
          provider: "Cashfree",
          periodStart: new Date().toISOString(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          issuedAt: new Date().toISOString(),
          invoiceUrl: "#"
        }
      ]
    },
    kyc: {
      status: "APPROVED",
      label: "Verified",
      requiredDocuments: kycDocumentRequirements.map((requirement) => ({ ...requirement })),
      documents: [],
      requiredDocumentCount: kycDocumentRequirements.length,
      uploadedDocumentCount: kycDocumentRequirements.length,
      missingDocumentCount: 0,
      hasAllDocuments: true,
      canUpload: false,
      readyForReview: false,
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      rejectionReason: null
    },
    wallet: {
      grossCredited: completedPayments.reduce((sum, payment) => sum + payment.amount, 0),
      platformFees: 0,
      pendingProviderSettlement: 0,
      availableForPayout: completedPayments.reduce((sum, payment) => sum + payment.amount, 0),
      processingPayouts: 0,
      settledCredits: 0,
      paidOut: 0
    }
  };
}

export function getDemoAdminPayload(): LiveAdminPayload {
  const businesses = platformBusinesses.map((business, index): LiveAdminBusiness => ({
    id: `demo_platform_business_${index}`,
    ...business,
    currentSubscriptionAmount: business.status === "Active" ? (business.plan === "Pro" ? 2999 : 1499) : 0,
    subscriptionStatus: business.status === "Active" ? "ACTIVE" : business.status === "Trial" ? "TRIAL" : business.status === "Inactive" ? "CANCELLED" : "PAST_DUE",
    address: demoBusinesses[index % demoBusinesses.length]?.address ?? "",
    state: demoBusinesses[index % demoBusinesses.length]?.state ?? "",
    businessType: demoBusinesses[index % demoBusinesses.length]?.businessType ?? "Local Service",
    isOpen: business.status !== "Inactive",
    serviceVisitFee: 0,
    latitude: demoBusinesses[index % demoBusinesses.length]?.latitude ?? null,
    longitude: demoBusinesses[index % demoBusinesses.length]?.longitude ?? null,
    serviceRadiusKm: 0,
    fulfillmentModes: demoBusinesses[index % demoBusinesses.length]?.fulfillmentModes ?? ["PICKUP"],
    acceptsPickup: demoBusinesses[index % demoBusinesses.length]?.fulfillmentModes.includes("PICKUP") ?? true,
    acceptsDineIn: demoBusinesses[index % demoBusinesses.length]?.fulfillmentModes.includes("DINE_IN") ?? false,
    acceptsServiceAtLocation: demoBusinesses[index % demoBusinesses.length]?.fulfillmentModes.includes("SERVICE_AT_LOCATION") ?? false,
    payoutMethod: "UPI",
    payoutUpiId: "demo@bank",
    payoutUpiName: business.name,
    payoutAccountHolderName: business.name,
    payoutBankName: null,
    payoutBankAccountNumber: null,
    payoutBankIfsc: null,
    setupCompletedAt: new Date().toISOString(),
    whatsappDisplayPhone: business.phone,
    whatsappPhoneNumberId: `demo_phone_number_${index}`,
    whatsappWabaId: `demo_waba_${index}`,
    whatsappConnected: index % 3 !== 0,
    whatsappLiveEnabled: index % 3 === 1,
    whatsappApprovedAt: index % 3 === 1 ? new Date().toISOString() : null,
    whatsappAccessTokenConfigured: index % 3 !== 0,
    cashfreeVendorId: null,
    cashfreeSplitEnabled: false,
    platformFeeBps: index % 2 === 0 ? 200 : 0,
    walletGrossCredited: business.revenue,
    walletPlatformFees: Math.round((business.revenue * (index % 2 === 0 ? 200 : 0)) / 10_000),
    walletPendingProviderSettlement: Math.round(business.revenue * 0.2),
    walletAvailableForPayout: Math.round(business.revenue * 0.25),
    walletProcessingPayouts: Math.round(business.revenue * 0.08),
    walletSettledCredits: Math.round(business.revenue * 0.55),
    walletPaidOut: Math.round(business.revenue * 0.55),
    customers: Math.max(12, Math.round(business.orders / 5)),
    kycStatus: business.kyc.toLowerCase() === "verified" ? "APPROVED" : "UNDER_REVIEW",
    kycDocuments: [],
    kycRequiredDocumentCount: kycDocumentRequirements.length,
    kycUploadedDocumentCount: business.kyc.toLowerCase() === "verified" ? kycDocumentRequirements.length : 0,
    kycMissingDocumentCount: business.kyc.toLowerCase() === "verified" ? 0 : kycDocumentRequirements.length,
    kycReadyForApproval: business.kyc.toLowerCase() !== "verified" && business.status === "Active",
    kycSubmittedAt: null,
    kycReviewedAt: business.kyc.toLowerCase() === "verified" ? new Date().toISOString() : null,
    kycRejectionReason: null,
    createdAt: new Date().toISOString()
  }));

  return {
    source: "demo",
    syncedAt: new Date().toISOString(),
    metrics: {
      totalBusinesses: 148,
      activeBusinesses: 121,
      activeSubscriptions: 121,
      monthlyRecurringRevenue: 284000,
      pendingSubscriptionPayments: 6,
      subscriptionPlanCounts: { STARTER: 57, PRO: 64 },
      ordersToday: 1840,
      paymentFailures: 27,
      whatsappMessagesSent: 12800,
      newSignups7d: 19,
      churnedBusinesses: 4,
      pendingBusinessPayouts: businesses.reduce((sum, business) => sum + business.walletAvailableForPayout, 0)
    },
    businesses,
    subscriptions: businesses.slice(0, 12).map((business, index): LiveAdminSubscription => ({
      id: `demo_subscription_${index}`,
      reference: `SUBINV-DEMO-${String(index + 1).padStart(3, "0")}`,
      invoiceUrl: "#",
      businessId: business.id,
      businessName: business.name,
      ownerName: business.name,
      ownerPhone: business.phone,
      ownerEmail: `owner${index + 1}@example.com`,
      plan: business.plan === "Pro" ? "PRO" : "STARTER",
      amount: business.plan === "Pro" ? subscriptionPlanAmounts.PRO : subscriptionPlanAmounts.STARTER,
      status: business.subscriptionStatus,
      paymentState: business.subscriptionStatus === "ACTIVE" ? "COMPLETED" : "PENDING",
      paymentProvider: index % 3 === 0 ? "UPI" : "CASHFREE",
      paymentProviderLabel: index % 3 === 0 ? "PSHR Innovex UPI" : "Cashfree",
      paidAt: business.subscriptionStatus === "ACTIVE" ? new Date().toISOString() : null,
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    })),
    auditLogs: [
      {
        id: "demo_audit_1",
        source: "audit",
        action: "BUSINESS_APPROVED",
        entity: "Business",
        status: "COMPLETED",
        businessId: businesses[0]?.id ?? null,
        businessName: businesses[0]?.name ?? "Sri Sai Tiffins",
        actorName: "PSHR Admin",
        summary: "Business approval completed",
        detail: "KYC and subscription checks passed",
        reference: businesses[0]?.id ?? null,
        occurredAt: new Date(Date.now() - 8 * 60 * 1000).toISOString()
      },
      {
        id: "demo_audit_2",
        source: "audit",
        action: "PLATFORM_FEE_UPDATED",
        entity: "Business",
        status: "ACTIVE",
        businessId: businesses[1]?.id ?? null,
        businessName: businesses[1]?.name ?? "Fresh Bowl Cloud Kitchen",
        actorName: "PSHR Admin",
        summary: "Platform fee changed to 2%",
        detail: "Payout setup updated",
        reference: businesses[1]?.id ?? null,
        occurredAt: new Date(Date.now() - 21 * 60 * 1000).toISOString()
      },
      {
        id: "demo_audit_3",
        source: "audit",
        action: "KYC_REJECTED",
        entity: "BusinessKycDocument",
        status: "FAILED",
        businessId: businesses[2]?.id ?? null,
        businessName: businesses[2]?.name ?? "Sweet Cravings Home Bakery",
        actorName: "PSHR Admin",
        summary: "KYC document needs resubmission",
        detail: "Address proof did not match business profile",
        reference: businesses[2]?.id ?? null,
        occurredAt: new Date(Date.now() - 39 * 60 * 1000).toISOString()
      }
    ],
    whatsappLogs: [
      {
        id: "demo_whatsapp_1",
        source: "whatsapp",
        action: "ORDER_STATUS_TEMPLATE",
        entity: "WhatsappMessage",
        status: "SENT",
        businessId: businesses[0]?.id ?? null,
        businessName: businesses[0]?.name ?? "Sri Sai Tiffins",
        actorName: "WhatsApp Cloud API",
        summary: "order_status_update to Ramesh",
        detail: "Order VM-1042",
        reference: "wa_demo_1042",
        occurredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      },
      {
        id: "demo_whatsapp_2",
        source: "whatsapp",
        action: "PAYMENT_REMINDER",
        entity: "WhatsappMessage",
        status: "QUEUED",
        businessId: businesses[1]?.id ?? null,
        businessName: businesses[1]?.name ?? "Fresh Bowl Cloud Kitchen",
        actorName: "WhatsApp Cloud API",
        summary: "payment_reminder to **** 3310",
        detail: "Awaiting provider confirmation",
        reference: null,
        occurredAt: new Date(Date.now() - 24 * 60 * 1000).toISOString()
      },
      {
        id: "demo_whatsapp_3",
        source: "whatsapp",
        action: "ORDER_READY_TEMPLATE",
        entity: "WhatsappMessage",
        status: "FAILED",
        businessId: businesses[2]?.id ?? null,
        businessName: businesses[2]?.name ?? "Sweet Cravings Home Bakery",
        actorName: "WhatsApp Cloud API",
        summary: "order_ready to Asha",
        detail: "Provider rejected the destination number",
        reference: null,
        occurredAt: new Date(Date.now() - 48 * 60 * 1000).toISOString()
      }
    ],
    paymentLogs: [
      {
        id: "demo_payment_1",
        source: "payment",
        action: "PAYMENT_COMPLETED",
        entity: "Payment",
        status: "COMPLETED",
        businessId: businesses[0]?.id ?? null,
        businessName: businesses[0]?.name ?? "Sri Sai Tiffins",
        actorName: "Cashfree",
        summary: "Cashfree order payment completed",
        detail: "Order VM-1042",
        reference: "cf_demo_1042",
        occurredAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
      },
      {
        id: "demo_payment_2",
        source: "payment",
        action: "SUBSCRIPTION_PAYMENT_PENDING",
        entity: "Subscription",
        status: "PENDING",
        businessId: businesses[1]?.id ?? null,
        businessName: businesses[1]?.name ?? "Fresh Bowl Cloud Kitchen",
        actorName: "PSHR Innovex UPI",
        summary: "Pro plan checkout awaiting bank verification",
        detail: "Subscription invoice SUBINV-DEMO-002",
        reference: "SUBINV-DEMO-002",
        occurredAt: new Date(Date.now() - 31 * 60 * 1000).toISOString()
      },
      {
        id: "demo_payment_3",
        source: "payment",
        action: "PAYMENT_FAILED",
        entity: "Payment",
        status: "FAILED",
        businessId: businesses[2]?.id ?? null,
        businessName: businesses[2]?.name ?? "Sweet Cravings Home Bakery",
        actorName: "Cashfree",
        summary: "Cashfree order payment failed",
        detail: "Gateway status FAILED",
        reference: "cf_demo_failed",
        occurredAt: new Date(Date.now() - 44 * 60 * 1000).toISOString()
      }
    ]
  };
}
