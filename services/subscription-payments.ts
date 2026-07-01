import type { PaymentProvider } from "@prisma/client";
import { subscriptionPeriodEnd } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import {
  createCashfreeOrder,
  getCashfreeOrderStatus,
  getCashfreeSuccessfulPayment,
  isCashfreeConfigured,
  isCashfreeFailedStatus,
  isCashfreePaidStatus
} from "@/services/cashfree";
import { gatewayPaymentMatches } from "@/services/payment-verification";

type SubscriptionPaymentProvider = Extract<PaymentProvider, "CASHFREE" | "UPI">;

export type SubscriptionPaymentRequest = {
  provider: Extract<PaymentProvider, "CASHFREE">;
  providerLabel: string;
  status: string;
  paymentRequestId: string;
  paymentRequestUrl: string;
  paymentQrImageUrl: string | null;
  expiresAt: string;
  receiverName: string;
  cashfreeOrderId: string;
  cashfreeCfOrderId: string | null;
  cashfreePaymentSessionId: string;
};

function cleanAppUrl(appUrl: string) {
  return appUrl.replace(/\/$/, "");
}

function subscriptionCheckoutUrl(appUrl: string, subscriptionId: string) {
  return `${cleanAppUrl(appUrl)}/api/dashboard/billing/checkout/${encodeURIComponent(subscriptionId)}/cashfree`;
}

export async function createSubscriptionPaymentRequest(input: {
  appUrl: string;
  amount: number;
  referenceId: string;
  subscriptionId: string;
  businessId: string;
  businessName: string;
  plan: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}): Promise<SubscriptionPaymentRequest> {
  const payment = await createCashfreeOrder({
    kind: "subscription",
    amount: input.amount,
    orderNumber: input.referenceId,
    orderId: input.subscriptionId,
    subscriptionId: input.subscriptionId,
    plan: input.plan,
    businessId: input.businessId,
    businessName: input.businessName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    returnUrl: `${cleanAppUrl(input.appUrl)}/dashboard/billing/payment/${encodeURIComponent(input.subscriptionId)}?checkout=return`,
    notifyUrl: `${cleanAppUrl(input.appUrl)}/api/webhooks/cashfree`,
    cashfreeVendorId: null,
    cashfreeSplitEnabled: false,
    platformFeeBps: 0
  });

  return {
    provider: "CASHFREE",
    providerLabel: "Cashfree",
    status: payment.status,
    paymentRequestId: payment.cashfreeOrderId,
    paymentRequestUrl: subscriptionCheckoutUrl(input.appUrl, input.subscriptionId),
    paymentQrImageUrl: null,
    expiresAt: payment.expiresAt,
    receiverName: process.env.PAYMENT_RECEIVER_NAME?.trim() || "PSHR INNOVEX PRIVATE LIMITED",
    cashfreeOrderId: payment.cashfreeOrderId,
    cashfreeCfOrderId: payment.cashfreeCfOrderId,
    cashfreePaymentSessionId: payment.cashfreePaymentSessionId
  };
}

export async function completeSubscriptionPayment(input: {
  subscriptionId: string;
  provider: SubscriptionPaymentProvider;
  paidAt?: Date;
  providerPaymentId?: string | null;
  providerRequestId?: string | null;
  providerStatus?: string | null;
  cashfreeCfOrderId?: string | null;
  verifiedByUserId?: string | null;
  verificationReference?: string | null;
}) {
  const verificationReference = input.verificationReference?.trim().toUpperCase() || null;
  if (input.provider === "UPI" && (!verificationReference || !input.verifiedByUserId)) {
    return { updated: false, reason: "verification_required" as const };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      id: true,
      businessId: true,
      plan: true,
      paymentProvider: true,
      paymentStatus: true
    }
  });

  if (!subscription) return { updated: false, reason: "not_found" as const };
  if (subscription.paymentProvider !== input.provider) return { updated: false, reason: "provider_mismatch" as const };
  if (subscription.paymentStatus === "COMPLETED") return { updated: false, reason: "already_completed" as const };

  const paidAt = input.paidAt ?? new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.subscription.updateMany({
      where: {
        id: subscription.id,
        paymentProvider: input.provider,
        paymentStatus: { in: ["PENDING", "FAILED"] }
      },
      data: {
        status: "ACTIVE",
        paymentStatus: "COMPLETED",
        paidAt,
        startDate: paidAt,
        endDate: subscriptionPeriodEnd(paidAt),
        ...(input.provider === "CASHFREE"
          ? {
              ...(input.providerPaymentId ? { cashfreePaymentId: input.providerPaymentId } : {}),
              ...(input.providerRequestId ? { cashfreeOrderId: input.providerRequestId } : {}),
              ...(input.cashfreeCfOrderId ? { cashfreeCfOrderId: input.cashfreeCfOrderId } : {}),
              cashfreeOrderStatus: input.providerStatus ?? "PAID"
            }
          : {}),
        ...(input.provider === "UPI"
          ? {
              manualVerificationReference: verificationReference,
              manualVerifiedByUserId: input.verifiedByUserId ?? null,
              manualVerifiedAt: paidAt
            }
          : {})
      }
    });
    if (claimed.count === 0) return false;

    await tx.subscription.updateMany({
      where: {
        businessId: subscription.businessId,
        id: { not: subscription.id },
        status: "ACTIVE"
      },
      data: {
        status: "CANCELLED",
        endDate: paidAt
      }
    });

    await tx.business.update({
      where: { id: subscription.businessId },
      data: {
        subscriptionPlan: subscription.plan,
        subscriptionStatus: "ACTIVE"
      }
    });
    await tx.business.updateMany({
      where: {
        id: subscription.businessId,
        isVerified: false,
        kycStatus: { in: ["PAYMENT_PENDING", "REJECTED"] }
      },
      data: {
        kycStatus: "DOCUMENTS_PENDING",
        kycRejectionReason: null
      }
    });
    return true;
  });

  return { updated, reason: updated ? null : "already_completed" as const };
}

export async function failSubscriptionPayment(input: {
  subscriptionId: string;
  provider: SubscriptionPaymentProvider;
  providerPaymentId?: string | null;
  providerRequestId?: string | null;
  providerStatus?: string | null;
  cashfreeCfOrderId?: string | null;
}) {
  const result = await prisma.subscription.updateMany({
    where: {
      id: input.subscriptionId,
      paymentProvider: input.provider,
      paymentStatus: "PENDING"
    },
    data: {
      status: "PAST_DUE",
      paymentStatus: "FAILED",
      paidAt: null,
      ...(input.provider === "CASHFREE"
        ? {
            ...(input.providerPaymentId ? { cashfreePaymentId: input.providerPaymentId } : {}),
            ...(input.providerRequestId ? { cashfreeOrderId: input.providerRequestId } : {}),
            ...(input.cashfreeCfOrderId ? { cashfreeCfOrderId: input.cashfreeCfOrderId } : {}),
            cashfreeOrderStatus: input.providerStatus ?? "FAILED"
          }
        : {})
    }
  });

  return { updated: result.count > 0 };
}

export async function syncCashfreeSubscriptionPayment(subscriptionId: string) {
  if (!isCashfreeConfigured()) return { updated: false, reason: "not_configured" as const };

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      businessId: true,
      amount: true,
      paymentProvider: true,
      paymentStatus: true,
      paymentRequestExpiresAt: true,
      cashfreeOrderId: true,
      cashfreeCfOrderId: true
    }
  });

  if (!subscription) return { updated: false, reason: "not_found" as const };
  if (subscription.paymentProvider !== "CASHFREE") return { updated: false, reason: "provider_mismatch" as const };
  if (!subscription.cashfreeOrderId) return { updated: false, reason: "request_missing" as const };
  if (subscription.paymentStatus === "COMPLETED") return { updated: false, reason: "already_completed" as const };

  const status = await getCashfreeOrderStatus(subscription.cashfreeOrderId);
  const cashfreeStatus = status.orderStatus;
  const expiredLocally = Boolean(
    subscription.paymentRequestExpiresAt && subscription.paymentRequestExpiresAt.getTime() <= Date.now()
  );

  if (!isCashfreePaidStatus(cashfreeStatus)) {
    if (!isCashfreeFailedStatus(cashfreeStatus) && !expiredLocally) {
      return { updated: false, reason: "pending" as const, providerStatus: cashfreeStatus };
    }

    const result = await failSubscriptionPayment({
      subscriptionId: subscription.id,
      provider: "CASHFREE",
      providerRequestId: subscription.cashfreeOrderId,
      cashfreeCfOrderId: status.cfOrderId ?? subscription.cashfreeCfOrderId,
      providerStatus: cashfreeStatus ?? "FAILED"
    });
    return {
      updated: result.updated,
      reason: result.updated ? null : "already_failed" as const,
      paymentState: "FAILED" as const,
      providerStatus: cashfreeStatus
    };
  }

  const successfulPayment = await getCashfreeSuccessfulPayment(subscription.cashfreeOrderId);
  if (!successfulPayment) {
    return { updated: false, reason: "payment_missing" as const, providerStatus: cashfreeStatus };
  }

  if (
    !gatewayPaymentMatches({
      provider: "CASHFREE",
      expectedAmount: Number(subscription.amount),
      receivedAmount: successfulPayment.amount,
      receivedCurrency: successfulPayment.currency
    })
  ) {
    return {
      updated: false,
      reason: "payment_mismatch" as const,
      providerStatus: cashfreeStatus,
      paymentId: successfulPayment.paymentId
    };
  }

  const result = await completeSubscriptionPayment({
    subscriptionId: subscription.id,
    provider: "CASHFREE",
    providerPaymentId: successfulPayment.paymentId,
    providerRequestId: subscription.cashfreeOrderId,
    cashfreeCfOrderId: status.cfOrderId ?? subscription.cashfreeCfOrderId,
    providerStatus: cashfreeStatus ?? successfulPayment.status ?? "PAID",
    paidAt: successfulPayment.paidAt ?? new Date()
  });

  return {
    updated: result.updated,
    reason: result.updated ? null : result.reason,
    paymentState: "COMPLETED" as const,
    providerStatus: cashfreeStatus,
    paymentId: successfulPayment.paymentId
  };
}

export async function expireSubscriptionPayment(subscriptionId: string, expiredAt = new Date()) {
  const result = await prisma.subscription.updateMany({
    where: {
      id: subscriptionId,
      paymentStatus: "PENDING",
      paymentRequestExpiresAt: { lte: expiredAt }
    },
    data: { status: "PAST_DUE", paymentStatus: "FAILED", paidAt: null }
  });

  return result.count > 0;
}
