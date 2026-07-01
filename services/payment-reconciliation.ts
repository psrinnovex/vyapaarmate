import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { completeGatewayOrderPayment, failGatewayOrderPayment } from "@/services/business-wallet";
import {
  getCashfreeOrderStatus,
  getCashfreeSuccessfulPayment,
  isCashfreeConfigured,
  isCashfreeFailedStatus,
  isCashfreePaidStatus
} from "@/services/cashfree";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";
import { gatewayPaymentMatches } from "@/services/payment-verification";
import { syncCashfreeSubscriptionPayment } from "@/services/subscription-payments";

type PaymentSyncState = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

function reconciliationBatchSize(limit?: number) {
  const parsed = Number(limit ?? process.env.PAYMENT_RECONCILIATION_BATCH_SIZE ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function failedPaymentReconciliationLookbackMinutes() {
  const parsed = Number(process.env.PAYMENT_RECONCILIATION_FAILED_LOOKBACK_MINUTES ?? 60);
  if (!Number.isFinite(parsed)) return 60;
  return Math.min(24 * 60, Math.max(5, Math.floor(parsed)));
}

export async function syncCashfreeOrderPayment(paymentId: string, source = "cashfree_reconciliation") {
  if (!isCashfreeConfigured()) return { updated: false, reason: "not_configured" as const };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      businessId: true,
      orderId: true,
      provider: true,
      amount: true,
      status: true,
      cashfreeOrderId: true,
      cashfreeCfOrderId: true,
      cashfreeOrderStatus: true,
      cashfreePaymentSessionId: true,
      paymentRequestExpiresAt: true,
      order: { select: { orderNumber: true, paymentStatus: true } }
    }
  });

  if (!payment) return { updated: false, reason: "not_found" as const };
  if (payment.provider !== "CASHFREE") return { updated: false, reason: "provider_mismatch" as const };
  if (!payment.cashfreeOrderId) return { updated: false, reason: "request_missing" as const };
  if (payment.status === "COMPLETED") return { updated: false, reason: "already_completed" as const };
  if (!["PENDING", "FAILED"].includes(payment.status) || !["PENDING", "FAILED"].includes(payment.order.paymentStatus)) {
    return { updated: false, reason: "not_reconcilable" as const };
  }

  const status = await getCashfreeOrderStatus(payment.cashfreeOrderId);
  const checkedAt = new Date();
  const cashfreeStatus = status.orderStatus ?? payment.cashfreeOrderStatus;
  const expiredLocally = Boolean(
    payment.paymentRequestExpiresAt && payment.paymentRequestExpiresAt.getTime() <= checkedAt.getTime()
  );

  if (!isCashfreePaidStatus(cashfreeStatus)) {
    if (!isCashfreeFailedStatus(cashfreeStatus) && !expiredLocally) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          cashfreeOrderStatus: cashfreeStatus,
          cashfreeCfOrderId: status.cfOrderId ?? payment.cashfreeCfOrderId,
          cashfreePaymentSessionId: status.paymentSessionId ?? payment.cashfreePaymentSessionId
        }
      });
      return {
        updated: false,
        reason: "pending" as const,
        paymentState: "PENDING" as PaymentSyncState,
        providerStatus: cashfreeStatus
      };
    }

    const providerStatus = isCashfreeFailedStatus(cashfreeStatus) ? cashfreeStatus : "EXPIRED_LOCALLY";
    const result = await failGatewayOrderPayment({
      paymentId: payment.id,
      provider: "CASHFREE",
      providerRequestId: payment.cashfreeOrderId,
      cashfreeCfOrderId: status.cfOrderId ?? payment.cashfreeCfOrderId,
      providerStatus
    });
    if (!result.updated) {
      return {
        updated: false,
        reason: "already_failed" as const,
        paymentState: "FAILED" as PaymentSyncState,
        providerStatus
      };
    }

    await Promise.all([
      writeAuditLog({
        userId: null,
        businessId: payment.businessId,
        action: "ORDER_PAYMENT_FAILED",
        entity: "Payment",
        entityId: payment.id,
        metadata: {
          orderId: payment.orderId,
          orderNumber: payment.order.orderNumber,
          amount: Number(payment.amount),
          paymentRequestId: payment.cashfreeOrderId,
          cashfreeOrderStatus: cashfreeStatus,
          failureReason: expiredLocally
            ? "Cashfree did not receive a verified payment before the checkout expired."
            : "Cashfree reported that the payment checkout was not completed.",
          failureSource: source,
          failedAt: checkedAt.toISOString()
        }
      }),
      sendOrderWhatsappUpdate({ businessId: payment.businessId, orderId: payment.orderId })
    ]);

    return {
      updated: true,
      reason: null,
      paymentState: "FAILED" as PaymentSyncState,
      providerStatus
    };
  }

  const successfulPayment = await getCashfreeSuccessfulPayment(payment.cashfreeOrderId);
  if (!successfulPayment) {
    return {
      updated: false,
      reason: "payment_missing" as const,
      paymentState: "PENDING" as PaymentSyncState,
      providerStatus: cashfreeStatus
    };
  }

  if (
    !gatewayPaymentMatches({
      provider: "CASHFREE",
      expectedAmount: Number(payment.amount),
      receivedAmount: successfulPayment.amount,
      receivedCurrency: successfulPayment.currency
    })
  ) {
    return {
      updated: false,
      reason: "payment_mismatch" as const,
      paymentState: "PENDING" as PaymentSyncState,
      providerStatus: cashfreeStatus,
      paymentId: successfulPayment.paymentId
    };
  }

  const result = await completeGatewayOrderPayment({
    paymentId: payment.id,
    provider: "CASHFREE",
    providerPaymentId: successfulPayment.paymentId,
    providerRequestId: payment.cashfreeOrderId,
    cashfreeCfOrderId: status.cfOrderId ?? payment.cashfreeCfOrderId,
    providerStatus: cashfreeStatus ?? successfulPayment.status ?? "PAID",
    paidAt: successfulPayment.paidAt ?? checkedAt
  });
  if (!result.updated) {
    return {
      updated: false,
      reason: "reason" in result ? result.reason : "already_completed" as const,
      paymentState: "COMPLETED" as PaymentSyncState,
      providerStatus: cashfreeStatus,
      paymentId: successfulPayment.paymentId
    };
  }
  const refundedAfterCancellation = "refunded" in result && result.refunded;

  await Promise.all([
    writeAuditLog({
      userId: null,
      businessId: payment.businessId,
      action: refundedAfterCancellation ? "ORDER_PAYMENT_REFUNDED" : "ORDER_PAYMENT_CONFIRMED",
      entity: "Payment",
      entityId: payment.id,
      metadata: {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        amount: Number(payment.amount),
        paymentRequestId: payment.cashfreeOrderId,
        paymentId: successfulPayment.paymentId,
        cashfreeOrderStatus: cashfreeStatus,
        receivedAmount: successfulPayment.amount,
        receivedCurrency: successfulPayment.currency,
        source,
        paidAt: checkedAt.toISOString(),
        refundReason: refundedAfterCancellation ? "business_cancelled_order" : undefined
      }
    }),
    sendOrderWhatsappUpdate({ businessId: payment.businessId, orderId: payment.orderId })
  ]);

  return {
    updated: true,
    reason: null,
    paymentState: refundedAfterCancellation ? "REFUNDED" as PaymentSyncState : "COMPLETED" as PaymentSyncState,
    providerStatus: cashfreeStatus,
    paymentId: successfulPayment.paymentId
  };
}

export async function reconcileAbandonedCashfreePayments(input: { now?: Date; limit?: number } = {}) {
  const now = input.now ?? new Date();
  const limit = reconciliationBatchSize(input.limit);
  const source = "cashfree_abandoned_checkout_job";
  const recentFailedAfter = new Date(now.getTime() - failedPaymentReconciliationLookbackMinutes() * 60_000);

  if (!isCashfreeConfigured()) {
    return {
      checkedOrderPayments: 0,
      checkedSubscriptions: 0,
      ordersCompleted: 0,
      ordersRefunded: 0,
      ordersFailed: 0,
      subscriptionsCompleted: 0,
      subscriptionsFailed: 0,
      pending: 0,
      errors: 0,
      reason: "not_configured" as const
    };
  }

  const [payments, subscriptions] = await Promise.all([
    prisma.payment.findMany({
      where: {
        provider: "CASHFREE",
        cashfreeOrderId: { not: null },
        OR: [
          {
            status: "PENDING",
            paymentRequestExpiresAt: { lte: now }
          },
          {
            status: "FAILED",
            paymentRequestExpiresAt: { gte: recentFailedAfter, lte: now }
          }
        ]
      },
      select: { id: true },
      orderBy: { paymentRequestExpiresAt: "asc" },
      take: limit
    }),
    prisma.subscription.findMany({
      where: {
        paymentProvider: "CASHFREE",
        paymentStatus: "PENDING",
        cashfreeOrderId: { not: null },
        paymentRequestExpiresAt: { lte: now }
      },
      select: {
        id: true,
        businessId: true,
        plan: true,
        amount: true,
        invoiceNumber: true,
        cashfreeOrderId: true
      },
      orderBy: { paymentRequestExpiresAt: "asc" },
      take: limit
    })
  ]);

  const summary = {
    checkedOrderPayments: payments.length,
    checkedSubscriptions: subscriptions.length,
    ordersCompleted: 0,
    ordersRefunded: 0,
    ordersFailed: 0,
    subscriptionsCompleted: 0,
    subscriptionsFailed: 0,
    pending: 0,
    errors: 0
  };

  for (const payment of payments) {
    try {
      const result = await syncCashfreeOrderPayment(payment.id, source);
      if ("paymentState" in result && result.paymentState === "COMPLETED" && result.updated) summary.ordersCompleted += 1;
      else if ("paymentState" in result && result.paymentState === "REFUNDED" && result.updated) summary.ordersRefunded += 1;
      else if ("paymentState" in result && result.paymentState === "FAILED" && result.updated) summary.ordersFailed += 1;
      else summary.pending += 1;
    } catch (error) {
      console.error("Cashfree order payment reconciliation failed", error);
      summary.errors += 1;
    }
  }

  for (const subscription of subscriptions) {
    try {
      const result = await syncCashfreeSubscriptionPayment(subscription.id);
      const paymentState = "paymentState" in result ? result.paymentState : null;
      if (!result.updated || !paymentState) {
        summary.pending += 1;
        continue;
      }

      if (paymentState === "COMPLETED") summary.subscriptionsCompleted += 1;
      if (paymentState === "FAILED") summary.subscriptionsFailed += 1;

      await writeAuditLog({
        userId: null,
        businessId: subscription.businessId,
        action: paymentState === "COMPLETED" ? "SUBSCRIPTION_PAYMENT_CONFIRMED" : "SUBSCRIPTION_PAYMENT_FAILED",
        entity: "Subscription",
        entityId: subscription.id,
        metadata: {
          plan: subscription.plan,
          invoiceNumber: subscription.invoiceNumber,
          amount: Number(subscription.amount),
          paymentRequestId: subscription.cashfreeOrderId,
          providerStatus: "providerStatus" in result ? result.providerStatus : null,
          paymentId: "paymentId" in result ? result.paymentId : null,
          source,
          reconciledAt: now.toISOString()
        }
      });
    } catch (error) {
      console.error("Cashfree subscription reconciliation failed", error);
      summary.errors += 1;
    }
  }

  return summary;
}
