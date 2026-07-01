import crypto, { randomUUID } from "crypto";

export type CashfreeEnvironment = "sandbox" | "production";

export type CashfreeOrderInput = {
  kind?: "customer_order" | "subscription";
  amount: number;
  orderNumber: string;
  orderId: string;
  publicToken?: string;
  subscriptionId?: string;
  plan?: string;
  businessId: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  returnUrl: string;
  notifyUrl: string;
  cashfreeVendorId?: string | null;
  cashfreeSplitEnabled?: boolean;
  platformFeeBps?: number;
  expiresInMinutes?: number;
};

export type CashfreeOrderResult = {
  provider: "CASHFREE";
  status: string;
  cashfreeOrderId: string;
  cashfreeCfOrderId: string | null;
  cashfreePaymentSessionId: string;
  expiresAt: string;
  message: string;
};

type CashfreeErrorResponse = {
  message?: string;
  code?: string;
  type?: string;
};

type CashfreeCreateOrderResponse = CashfreeErrorResponse & {
  order_id?: string;
  cf_order_id?: string | number;
  order_status?: string;
  payment_session_id?: string;
  order_expiry_time?: string;
};

type CashfreeOrderStatusResponse = CashfreeCreateOrderResponse & {
  order_amount?: number;
  order_currency?: string;
};

type CashfreePaymentResponse = CashfreeErrorResponse & {
  cf_payment_id?: string | number;
  payment_status?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_time?: string;
};

type CashfreeRefundResponse = CashfreeErrorResponse & {
  cf_payment_id?: string | number;
  cf_refund_id?: string | number;
  refund_id?: string;
  order_id?: string;
  refund_amount?: number;
  refund_currency?: string;
  refund_note?: string;
  refund_status?: string;
  status_description?: string;
  created_at?: string;
  processed_at?: string;
};

type CashfreeOrderSplit = {
  vendor: string;
  amount: number;
};

const CASHFREE_API_VERSION = "2025-01-01";
const CASHFREE_ORDER_EXPIRY_DEFAULT_MINUTES = 30;
const CASHFREE_ORDER_EXPIRY_MIN_MINUTES = 16;
const CASHFREE_ORDER_EXPIRY_MAX_MINUTES = 1440;

function cleanEnv(value: string | undefined) {
  return value?.trim() ?? "";
}

export function cashfreeEnvironment(): CashfreeEnvironment {
  return cleanEnv(process.env.CASHFREE_ENV).toLowerCase() === "production" ? "production" : "sandbox";
}

function cashfreeBaseUrl() {
  return cashfreeEnvironment() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

export function isCashfreeConfigured() {
  return Boolean(cleanEnv(process.env.CASHFREE_APP_ID) && cleanEnv(process.env.CASHFREE_SECRET_KEY));
}

export function isCashfreeSplitEnabled() {
  return cleanEnv(process.env.CASHFREE_SPLIT_ENABLED).toLowerCase() === "true";
}

export function canBusinessAcceptCashfreePayment(business: {
  cashfreeVendorId?: string | null;
  cashfreeSplitEnabled?: boolean;
}) {
  void business;
  return isCashfreeConfigured();
}

function cashfreeHeaders(extra?: HeadersInit): HeadersInit {
  const appId = cleanEnv(process.env.CASHFREE_APP_ID);
  const secretKey = cleanEnv(process.env.CASHFREE_SECRET_KEY);
  return {
    "Content-Type": "application/json",
    "x-client-id": appId,
    "x-client-secret": secretKey,
    "x-api-version": CASHFREE_API_VERSION,
    ...extra
  };
}

function safeCashfreeId(value: string, fallback: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || fallback).slice(0, 45);
}

function cashfreeOrderId(orderNumber: string, orderId: string) {
  return safeCashfreeId(`vm_${orderNumber}_${Date.now().toString(36)}`, `vm_${orderId.slice(-20)}`);
}

function safeCashfreeRefundId(value: string, fallback: string) {
  return safeCashfreeId(value, fallback).slice(0, 40);
}

export function cashfreeRefundIdForPayment(paymentId: string) {
  return safeCashfreeRefundId(`vmref_${paymentId.replace(/[^A-Za-z0-9]/g, "").slice(-30)}`, `vmref_${Date.now().toString(36)}`);
}

function cashfreeCustomerId(phone: string, orderId: string) {
  const digits = phone.replace(/\D/g, "");
  return safeCashfreeId(`cust_${digits.slice(-12) || orderId.slice(-16)}`, `cust_${orderId.slice(-16)}`);
}

function cashfreeCustomerPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function boundedMinutes(value: number | string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function paymentCheckoutExpiresInMinutes() {
  return boundedMinutes(
    process.env.PAYMENT_CHECKOUT_EXPIRES_MINUTES,
    CASHFREE_ORDER_EXPIRY_DEFAULT_MINUTES,
    CASHFREE_ORDER_EXPIRY_MIN_MINUTES,
    CASHFREE_ORDER_EXPIRY_MAX_MINUTES
  );
}

function checkoutExpiresAt(expiresInMinutes?: number) {
  const minutes = boundedMinutes(
    expiresInMinutes,
    paymentCheckoutExpiresInMinutes(),
    CASHFREE_ORDER_EXPIRY_MIN_MINUTES,
    CASHFREE_ORDER_EXPIRY_MAX_MINUTES
  );
  return new Date(Date.now() + minutes * 60_000);
}

function amountToPaise(amount: number) {
  return Math.round(amount * 100);
}

function paiseToAmount(paise: number) {
  return Math.max(0, Math.round(paise) / 100);
}

function cashfreeSplits(input: CashfreeOrderInput): CashfreeOrderSplit[] | undefined {
  if (!isCashfreeSplitEnabled() || !input.cashfreeSplitEnabled || !input.cashfreeVendorId) return undefined;

  const totalPaise = amountToPaise(input.amount);
  const feeBps = Math.max(0, Math.min(5000, input.platformFeeBps ?? 0));
  const platformFeePaise = Math.min(totalPaise, Math.floor((totalPaise * feeBps) / 10_000));
  const vendorAmount = paiseToAmount(totalPaise - platformFeePaise);
  if (vendorAmount <= 0) return undefined;

  return [{ vendor: input.cashfreeVendorId, amount: vendorAmount }];
}

function cashfreeOrderTags(input: CashfreeOrderInput) {
  return {
    kind: input.kind ?? "customer_order",
    businessId: input.businessId,
    businessName: input.businessName.slice(0, 80),
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    ...(input.publicToken ? { publicToken: input.publicToken } : {}),
    ...(input.subscriptionId ? { subscriptionId: input.subscriptionId } : {}),
    ...(input.plan ? { plan: input.plan } : {})
  };
}

async function cashfreeRequest<T>(path: string, init: RequestInit = {}) {
  if (!isCashfreeConfigured()) {
    throw new Error("Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY, then restart the app.");
  }

  const response = await fetch(`${cashfreeBaseUrl()}${path}`, {
    ...init,
    headers: cashfreeHeaders(init.headers),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const payload = (await response.json().catch(() => ({}))) as T & CashfreeErrorResponse;

  if (!response.ok) {
    throw new Error(payload.message ?? payload.code ?? payload.type ?? `Cashfree request failed with ${response.status}`);
  }

  return payload;
}

export async function createCashfreeOrder(input: CashfreeOrderInput): Promise<CashfreeOrderResult> {
  if (input.amount < 1) {
    throw new Error("Cashfree orders must be at least ₹1.00.");
  }

  const orderId = cashfreeOrderId(input.orderNumber, input.orderId);
  const expiresAt = checkoutExpiresAt(input.expiresInMinutes);
  const splits = cashfreeSplits(input);
  const paymentMethods = cleanEnv(process.env.CASHFREE_PAYMENT_METHODS);

  const payload = await cashfreeRequest<CashfreeCreateOrderResponse>("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": randomUUID() },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Number(input.amount.toFixed(2)),
      order_currency: process.env.CASHFREE_CURRENCY ?? "INR",
      order_expiry_time: expiresAt.toISOString(),
      customer_details: {
        customer_id: cashfreeCustomerId(input.customerPhone, input.orderId),
        customer_name: input.customerName.slice(0, 99),
        customer_phone: cashfreeCustomerPhone(input.customerPhone),
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {})
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
        ...(paymentMethods ? { payment_methods: paymentMethods } : {})
      },
      order_tags: cashfreeOrderTags(input),
      ...(splits ? { order_splits: splits } : {})
    })
  });

  if (!payload.order_id || !payload.payment_session_id) {
    throw new Error("Cashfree order response did not include order_id and payment_session_id.");
  }

  return {
    provider: "CASHFREE",
    status: payload.order_status ?? "ACTIVE",
    cashfreeOrderId: payload.order_id,
    cashfreeCfOrderId: payload.cf_order_id === undefined || payload.cf_order_id === null ? null : String(payload.cf_order_id),
    cashfreePaymentSessionId: payload.payment_session_id,
    expiresAt: payload.order_expiry_time ? new Date(payload.order_expiry_time).toISOString() : expiresAt.toISOString(),
    message: "Cashfree checkout created."
  };
}

export async function getCashfreeOrderStatus(orderId: string) {
  const payload = await cashfreeRequest<CashfreeOrderStatusResponse>(`/orders/${encodeURIComponent(orderId)}`, {
    method: "GET"
  });

  if (!payload.order_id) {
    throw new Error("Cashfree order lookup response did not include order_id.");
  }

  return {
    orderId: payload.order_id,
    cfOrderId: payload.cf_order_id === undefined || payload.cf_order_id === null ? null : String(payload.cf_order_id),
    orderStatus: payload.order_status ?? null,
    paymentSessionId: payload.payment_session_id ?? null,
    expiresAt: payload.order_expiry_time ? new Date(payload.order_expiry_time).toISOString() : null,
    amount: payload.order_amount ?? null,
    currency: payload.order_currency ?? null
  };
}

export async function terminateCashfreeOrder(orderId: string) {
  const payload = await cashfreeRequest<CashfreeOrderStatusResponse>(`/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { "x-idempotency-key": randomUUID() },
    body: JSON.stringify({ order_status: "TERMINATED" })
  });

  if (!payload.order_id) {
    throw new Error("Cashfree order termination response did not include order_id.");
  }

  return {
    orderId: payload.order_id,
    cfOrderId: payload.cf_order_id === undefined || payload.cf_order_id === null ? null : String(payload.cf_order_id),
    orderStatus: payload.order_status ?? null,
    paymentSessionId: payload.payment_session_id ?? null,
    expiresAt: payload.order_expiry_time ? new Date(payload.order_expiry_time).toISOString() : null
  };
}

export async function getCashfreeSuccessfulPayment(orderId: string) {
  const payments = await cashfreeRequest<CashfreePaymentResponse[]>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { method: "GET" }
  );

  const payment = payments
    .filter((item) => item.payment_status === "SUCCESS" && item.cf_payment_id !== undefined && item.cf_payment_id !== null)
    .sort((a, b) => Date.parse(b.payment_time ?? "") - Date.parse(a.payment_time ?? ""))[0];
  if (!payment) return null;

  return {
    paymentId: String(payment.cf_payment_id),
    status: payment.payment_status ?? null,
    amount: payment.payment_amount ?? null,
    currency: payment.payment_currency ?? null,
    paidAt: payment.payment_time ? new Date(payment.payment_time) : null
  };
}

export async function createCashfreeOrderRefund(input: {
  orderId: string;
  amount: number;
  refundId: string;
  note?: string;
}) {
  if (input.amount <= 0) {
    throw new Error("Cashfree refunds must be greater than ₹0.00.");
  }

  const payload = await cashfreeRequest<CashfreeRefundResponse>(
    `/orders/${encodeURIComponent(input.orderId)}/refunds`,
    {
      method: "POST",
      headers: { "x-idempotency-key": randomUUID() },
      body: JSON.stringify({
        refund_amount: Number(input.amount.toFixed(2)),
        refund_id: safeCashfreeRefundId(input.refundId, `vmref_${Date.now().toString(36)}`),
        refund_note: (input.note?.trim() || "Order cancelled refund").slice(0, 100),
        refund_speed: "STANDARD"
      })
    }
  );

  if (!payload.refund_id && !payload.cf_refund_id) {
    throw new Error("Cashfree refund response did not include a refund ID.");
  }

  return {
    cfPaymentId: payload.cf_payment_id === undefined || payload.cf_payment_id === null ? null : String(payload.cf_payment_id),
    cfRefundId: payload.cf_refund_id === undefined || payload.cf_refund_id === null ? null : String(payload.cf_refund_id),
    refundId: payload.refund_id ?? input.refundId,
    orderId: payload.order_id ?? input.orderId,
    amount: payload.refund_amount ?? input.amount,
    currency: payload.refund_currency ?? null,
    status: payload.refund_status ?? null,
    statusDescription: payload.status_description ?? null,
    createdAt: payload.created_at ?? null,
    processedAt: payload.processed_at ?? null
  };
}

export function isCashfreePaidStatus(status: string | null | undefined) {
  return status === "PAID" || status === "SUCCESS";
}

export function isCashfreeFailedStatus(status: string | null | undefined) {
  return (
    status === "EXPIRED" ||
    status === "TERMINATED" ||
    status === "TERMINATION_REQUESTED" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "USER_DROPPED"
  );
}

export function verifyCashfreeWebhookSignature(payload: string, signature: string, timestamp: string) {
  const secret = cleanEnv(process.env.CASHFREE_SECRET_KEY);
  if (!secret) return { verified: false, reason: "CASHFREE_SECRET_KEY is not configured" };
  if (!signature || !timestamp) return { verified: false, reason: "Cashfree webhook signature headers are missing" };

  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}${payload}`).digest("base64");
  const digestBuffer = Buffer.from(digest);
  const signatureBuffer = Buffer.from(signature);
  if (digestBuffer.length !== signatureBuffer.length) {
    return { verified: false, reason: "Signature length mismatch" };
  }

  return { verified: crypto.timingSafeEqual(digestBuffer, signatureBuffer) };
}
