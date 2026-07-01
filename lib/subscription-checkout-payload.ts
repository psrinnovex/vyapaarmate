import { getPlatformPaymentSettings } from "@/services/platform-payment-settings";
import { createUpiQrImageDataUrl } from "@/services/upi";

export type SubscriptionCheckoutPayloadSource = {
  id: string;
  plan: "STARTER" | "PRO";
  amount: { toString(): string } | number | string;
  subtotalAmount?: { toString(): string } | number | string | null;
  discountAmount?: { toString(): string } | number | string | null;
  upgradeCreditAmount?: { toString(): string } | number | string | null;
  upgradedFromSubscriptionId?: string | null;
  taxableAmount?: { toString(): string } | number | string | null;
  gstRateBps?: number | null;
  gstAmount?: { toString(): string } | number | string | null;
  billingGstin?: string | null;
  couponCode?: string | null;
  status: string;
  paymentStatus: string;
  paymentProvider: string;
  paymentRequestUrl: string | null;
  paymentRequestExpiresAt: Date | string | null;
  invoiceNumber?: string | null;
};

export type SubscriptionCheckoutPayload = {
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

function isoDate(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function providerLabel(provider: string) {
  if (provider === "CASHFREE") return "Cashfree";
  if (provider === "UPI") return "PSHR Innovex UPI";
  return provider;
}

async function receiverName(provider: string) {
  if (provider === "UPI") {
    const settings = await getPlatformPaymentSettings();
    return settings.upiName || "PSHR INNOVEX PRIVATE LIMITED";
  }

  return process.env.PAYMENT_RECEIVER_NAME?.trim() || "PSHR INNOVEX PRIVATE LIMITED";
}

async function paymentQrImageUrl(provider: string, paymentUrl: string | null) {
  if (!paymentUrl) return null;
  if (provider === "CASHFREE") return null;

  if (provider === "UPI" && paymentUrl.startsWith("upi://")) {
    try {
      return await createUpiQrImageDataUrl(paymentUrl);
    } catch {
      return null;
    }
  }

  return /^https?:\/\//i.test(paymentUrl) ? paymentUrl : null;
}

function failureReason(provider: string, paymentStatus: string) {
  if (paymentStatus !== "FAILED") return null;

  if (provider === "CASHFREE") {
    return "The Cashfree checkout was not confirmed. Create a fresh checkout to retry.";
  }

  return provider === "UPI"
    ? "This QR expired. If you already paid, wait for PSHR Innovex bank verification; otherwise create a fresh checkout."
    : "The payment was not confirmed before this checkout expired. Create a fresh checkout to retry.";
}

function checkoutMessage(provider: string, paymentStatus: string, status: string, receiver: string) {
  if (paymentStatus === "COMPLETED" || status === "ACTIVE") {
    return "Payment confirmed. Your subscription is active and the new billing period has started.";
  }

  if (paymentStatus === "FAILED") {
    return failureReason(provider, paymentStatus) ?? "Subscription payment was not completed.";
  }

  if (provider === "UPI") {
    return "Scan and pay " + receiver + ". Your plan activates after PSHR Innovex verifies the bank credit.";
  }

  return "Open Cashfree checkout and complete the payment. Cashfree confirmation activates the plan automatically.";
}

export async function buildSubscriptionCheckoutPayload(
  subscription: SubscriptionCheckoutPayloadSource
): Promise<SubscriptionCheckoutPayload> {
  const paymentUrl = subscription.paymentRequestUrl;
  const receiver = await receiverName(subscription.paymentProvider);
  const paymentState = subscription.paymentStatus;
  const amount = Number(subscription.amount);
  const subtotalAmount = Number(subscription.subtotalAmount ?? amount);
  const discountAmount = Number(subscription.discountAmount ?? 0);
  const upgradeCreditAmount = Number(subscription.upgradeCreditAmount ?? 0);
  const taxableAmount = Number(subscription.taxableAmount ?? Math.max(0, subtotalAmount - discountAmount - upgradeCreditAmount));
  const gstAmount = Number(subscription.gstAmount ?? Math.max(0, amount - taxableAmount));

  return {
    subscriptionId: subscription.id,
    plan: subscription.plan,
    amount,
    subtotalAmount: subtotalAmount > 0 ? subtotalAmount : amount,
    discountAmount,
    upgradeCreditAmount,
    upgradedFromSubscriptionId: subscription.upgradedFromSubscriptionId ?? null,
    taxableAmount,
    gstRateBps: subscription.gstRateBps ?? 1800,
    gstAmount,
    billingGstin: subscription.billingGstin ?? null,
    couponCode: subscription.couponCode ?? null,
    status: subscription.status,
    paymentState,
    paymentProvider: subscription.paymentProvider,
    paymentProviderLabel: providerLabel(subscription.paymentProvider),
    receiverName: receiver,
    paymentUrl,
    paymentQrImageUrl: await paymentQrImageUrl(subscription.paymentProvider, paymentUrl),
    paymentQrExpiresAt: isoDate(subscription.paymentRequestExpiresAt),
    invoiceNumber: subscription.invoiceNumber ?? null,
    invoiceUrl: "/dashboard/billing/invoices/" + subscription.id,
    failureReason: failureReason(subscription.paymentProvider, paymentState),
    message: checkoutMessage(subscription.paymentProvider, paymentState, subscription.status, receiver)
  };
}
