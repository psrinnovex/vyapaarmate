import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { isCashfreeFailedStatus, isCashfreePaidStatus } from "@/services/cashfree";
import { completeGatewayOrderPayment, failGatewayOrderPayment } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";
import { gatewayPaymentMatches } from "@/services/payment-verification";
import { completeSubscriptionPayment, failSubscriptionPayment } from "@/services/subscription-payments";

/**
 * Applies a Cashfree payment outcome to orders and subscriptions. Shared by the signed
 * Cashfree webhook and the demo checkout (DEMO_MODE), so both run the exact same
 * matching, amount verification, completion, audit and WhatsApp-update logic.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function cashfreeWebhookData(event: Record<string, unknown>) {
  const data = asRecord(event.data) ?? {};
  const order = asRecord(data.order) ?? asRecord(event.order) ?? {};
  const payment = asRecord(data.payment) ?? asRecord(event.payment) ?? {};
  const customerDetails = asRecord(data.customer_details) ?? {};
  const orderTags = asRecord(order.order_tags) ?? asRecord(data.order_tags) ?? {};

  return {
    eventType: stringValue(event.type),
    cashfreeOrderId: stringValue(order.order_id) ?? stringValue(data.order_id) ?? stringValue(event.order_id),
    cashfreeCfOrderId: stringValue(order.cf_order_id) ?? stringValue(data.cf_order_id) ?? stringValue(event.cf_order_id),
    cashfreePaymentId: stringValue(payment.cf_payment_id) ?? stringValue(payment.payment_id) ?? stringValue(data.cf_payment_id),
    orderStatus: stringValue(order.order_status) ?? stringValue(data.order_status),
    paymentStatus: stringValue(payment.payment_status) ?? stringValue(data.payment_status),
    paymentAmount: numberValue(payment.payment_amount) ?? numberValue(order.order_amount),
    paymentCurrency: stringValue(payment.payment_currency) ?? stringValue(order.order_currency),
    taggedOrderId: stringValue(orderTags.orderId),
    taggedSubscriptionId: stringValue(orderTags.subscriptionId),
    failureReason:
      stringValue(payment.payment_message) ??
      stringValue(payment.payment_group) ??
      "Cashfree reported that the payment attempt failed.",
    customerPhone: stringValue(customerDetails.customer_phone)
  };
}

export type CashfreePaymentEvent = ReturnType<typeof cashfreeWebhookData>;

export async function applyCashfreePaymentEvent(webhook: CashfreePaymentEvent, source: "cashfree_webhook" | "demo_checkout") {
  const paid = webhook.eventType === "PAYMENT_SUCCESS_WEBHOOK" && isCashfreePaidStatus(webhook.paymentStatus);
  const failed =
    (webhook.eventType === "PAYMENT_FAILED_WEBHOOK" || webhook.eventType === "PAYMENT_USER_DROPPED_WEBHOOK") &&
    isCashfreeFailedStatus(webhook.paymentStatus);

  if ((!webhook.cashfreeOrderId && !webhook.cashfreeCfOrderId) || (!paid && !failed)) {
    return ({ received: true, updated: false });
  }

  const matches = [
    ...(webhook.cashfreeOrderId ? [{ cashfreeOrderId: webhook.cashfreeOrderId }] : []),
    ...(webhook.cashfreeCfOrderId ? [{ cashfreeCfOrderId: webhook.cashfreeCfOrderId }] : [])
  ];
  let orderPayments = await prisma.payment.findMany({
    where: {
      ...(failed ? { provider: "CASHFREE" as const } : {}),
      status: paid ? { in: ["PENDING", "FAILED"] } : "PENDING",
      OR: matches
    },
    select: {
      id: true,
      orderId: true,
      businessId: true,
      amount: true,
      cashfreeOrderId: true,
      cashfreeCfOrderId: true,
      order: { select: { orderNumber: true } }
    }
  });

  if (paid && orderPayments.length === 0 && webhook.taggedOrderId) {
    orderPayments = await prisma.payment.findMany({
      where: {
        orderId: webhook.taggedOrderId,
        status: { in: ["PENDING", "FAILED"] }
      },
      select: {
        id: true,
        orderId: true,
        businessId: true,
        amount: true,
        cashfreeOrderId: true,
        cashfreeCfOrderId: true,
        order: { select: { orderNumber: true } }
      }
    });
  }

  let subscriptions = await prisma.subscription.findMany({
    where: {
      paymentProvider: "CASHFREE",
      paymentStatus: paid ? { in: ["PENDING", "FAILED"] } : "PENDING",
      OR: matches
    },
    select: {
      id: true,
      businessId: true,
      plan: true,
      amount: true,
      cashfreeOrderId: true,
      cashfreeCfOrderId: true,
      invoiceNumber: true
    }
  });

  if (paid && subscriptions.length === 0 && webhook.taggedSubscriptionId) {
    subscriptions = await prisma.subscription.findMany({
      where: {
        id: webhook.taggedSubscriptionId,
        paymentProvider: "CASHFREE",
        paymentStatus: { in: ["PENDING", "FAILED"] }
      },
      select: {
        id: true,
        businessId: true,
        plan: true,
        amount: true,
        cashfreeOrderId: true,
        cashfreeCfOrderId: true,
        invoiceNumber: true
      }
    });
  }

  if (orderPayments.length === 0 && subscriptions.length === 0) {
    return ({ received: true, updated: false });
  }

  if (paid && !webhook.cashfreePaymentId) {
    return ({ received: true, updated: false, reason: "Successful payment ID is missing." });
  }

  const invalidOrderPayments = paid
    ? orderPayments.filter(
        (paymentRow) =>
          !gatewayPaymentMatches({
            provider: "CASHFREE",
            expectedAmount: Number(paymentRow.amount),
            receivedAmount: webhook.paymentAmount,
            receivedCurrency: webhook.paymentCurrency
          })
      )
    : [];
  const invalidSubscriptions = paid
    ? subscriptions.filter(
        (subscription) =>
          !gatewayPaymentMatches({
            provider: "CASHFREE",
            expectedAmount: Number(subscription.amount),
            receivedAmount: webhook.paymentAmount,
            receivedCurrency: webhook.paymentCurrency
          })
      )
    : [];

  if (invalidOrderPayments.length || invalidSubscriptions.length) {
    await Promise.all([
      ...invalidOrderPayments.map((paymentRow) =>
        writeAuditLog({
          userId: null,
          businessId: paymentRow.businessId,
          action: "ORDER_PAYMENT_VERIFICATION_REJECTED",
          entity: "Payment",
          entityId: paymentRow.id,
          metadata: {
            provider: "CASHFREE",
            orderId: paymentRow.orderId,
            expectedAmount: Number(paymentRow.amount),
            receivedAmount: webhook.paymentAmount,
            receivedCurrency: webhook.paymentCurrency,
            cashfreeOrderId: webhook.cashfreeOrderId,
            cashfreePaymentId: webhook.cashfreePaymentId
          }
        })
      ),
      ...invalidSubscriptions.map((subscription) =>
        writeAuditLog({
          userId: null,
          businessId: subscription.businessId,
          action: "SUBSCRIPTION_PAYMENT_VERIFICATION_REJECTED",
          entity: "Subscription",
          entityId: subscription.id,
          metadata: {
            provider: "CASHFREE",
            plan: subscription.plan,
            expectedAmount: Number(subscription.amount),
            receivedAmount: webhook.paymentAmount,
            receivedCurrency: webhook.paymentCurrency,
            cashfreeOrderId: webhook.cashfreeOrderId,
            cashfreePaymentId: webhook.cashfreePaymentId
          }
        })
      )
    ]);
    return ({ received: true, updated: false, reason: "Payment amount or currency did not match." });
  }

  const paidAt = new Date();
  const orderStatus = paid ? "PAID" : webhook.orderStatus ?? webhook.paymentStatus ?? "FAILED";
  const subscriptionResults = await Promise.all(
    subscriptions.map(async (subscription) => {
      const providerRequestId = webhook.cashfreeOrderId ?? subscription.cashfreeOrderId;
      if (!providerRequestId) return false;

      const result = paid
        ? await completeSubscriptionPayment({
            subscriptionId: subscription.id,
            provider: "CASHFREE",
            providerPaymentId: webhook.cashfreePaymentId!,
            providerRequestId,
            cashfreeCfOrderId: webhook.cashfreeCfOrderId ?? subscription.cashfreeCfOrderId,
            providerStatus: orderStatus,
            paidAt
          })
        : await failSubscriptionPayment({
            subscriptionId: subscription.id,
            provider: "CASHFREE",
            providerPaymentId: webhook.cashfreePaymentId,
            providerRequestId,
            cashfreeCfOrderId: webhook.cashfreeCfOrderId ?? subscription.cashfreeCfOrderId,
            providerStatus: orderStatus
          });
      if (!result.updated) return false;

      await writeAuditLog({
        userId: null,
        businessId: subscription.businessId,
        action: paid ? "SUBSCRIPTION_PAYMENT_CONFIRMED" : "SUBSCRIPTION_PAYMENT_FAILED",
        entity: "Subscription",
        entityId: subscription.id,
        metadata: paid
          ? {
              plan: subscription.plan,
              invoiceNumber: subscription.invoiceNumber,
              amount: Number(subscription.amount),
              paymentRequestId: webhook.cashfreeOrderId,
              paymentId: webhook.cashfreePaymentId,
              cashfreeCfOrderId: webhook.cashfreeCfOrderId,
              receivedAmount: webhook.paymentAmount,
              receivedCurrency: webhook.paymentCurrency,
              paidAt: paidAt.toISOString(),
              source
            }
          : {
              plan: subscription.plan,
              invoiceNumber: subscription.invoiceNumber,
              amount: Number(subscription.amount),
              paymentRequestId: webhook.cashfreeOrderId,
              paymentId: webhook.cashfreePaymentId,
              cashfreeCfOrderId: webhook.cashfreeCfOrderId,
              failureReason: webhook.failureReason,
              failedAt: paidAt.toISOString(),
              source
            }
      });
      return true;
    })
  );
  const results = await Promise.all(
    orderPayments.map(async (paymentRow) => {
      const providerRequestId = webhook.cashfreeOrderId ?? paymentRow.cashfreeOrderId;
      if (!providerRequestId) return { updated: false, refunded: false };

      const result = paid
        ? await completeGatewayOrderPayment({
            paymentId: paymentRow.id,
            provider: "CASHFREE",
            providerPaymentId: webhook.cashfreePaymentId!,
            providerRequestId,
            cashfreeCfOrderId: webhook.cashfreeCfOrderId ?? paymentRow.cashfreeCfOrderId,
            providerStatus: orderStatus,
            paidAt
          })
        : await failGatewayOrderPayment({
            paymentId: paymentRow.id,
            provider: "CASHFREE",
            providerPaymentId: webhook.cashfreePaymentId,
            providerRequestId,
            cashfreeCfOrderId: webhook.cashfreeCfOrderId ?? paymentRow.cashfreeCfOrderId,
            providerStatus: orderStatus
          });
      if (!result.updated) return { updated: false, refunded: false };

      const refundedAfterCancellation = paid && "refunded" in result && result.refunded;

      await Promise.all([
        writeAuditLog({
          userId: null,
          businessId: paymentRow.businessId,
          action: refundedAfterCancellation
            ? "ORDER_PAYMENT_REFUNDED"
            : paid
              ? "ORDER_PAYMENT_CONFIRMED"
              : "ORDER_PAYMENT_FAILED",
          entity: "Payment",
          entityId: paymentRow.id,
          metadata: paid
            ? {
                orderId: paymentRow.orderId,
                orderNumber: paymentRow.order.orderNumber,
                amount: Number(paymentRow.amount),
                paymentRequestId: webhook.cashfreeOrderId,
                paymentId: webhook.cashfreePaymentId,
                cashfreeCfOrderId: webhook.cashfreeCfOrderId,
                receivedAmount: webhook.paymentAmount,
                receivedCurrency: webhook.paymentCurrency,
                paidAt: paidAt.toISOString(),
                source,
                refundReason: refundedAfterCancellation ? "business_cancelled_order" : undefined
              }
            : {
                orderId: paymentRow.orderId,
                orderNumber: paymentRow.order.orderNumber,
                amount: Number(paymentRow.amount),
                paymentRequestId: webhook.cashfreeOrderId,
                paymentId: webhook.cashfreePaymentId,
                cashfreeCfOrderId: webhook.cashfreeCfOrderId,
                failureReason: webhook.failureReason,
                failedAt: paidAt.toISOString(),
                source
              }
        }),
        sendOrderWhatsappUpdate({ businessId: paymentRow.businessId, orderId: paymentRow.orderId })
      ]);
      return { updated: true, refunded: refundedAfterCancellation };
    })
  );

  const updatedCount = results.filter((result) => result.updated).length;
  const refundedOrders = results.filter((result) => result.refunded).length;
  const subscriptionsUpdated = subscriptionResults.filter(Boolean).length;

  return ({
    received: true,
    updated: updatedCount > 0 || subscriptionsUpdated > 0,
    paymentState: paid && refundedOrders > 0 && refundedOrders === updatedCount && subscriptionsUpdated === 0 ? "REFUNDED" : paid ? "COMPLETED" : "FAILED",
    ordersUpdated: updatedCount,
    ordersRefunded: refundedOrders,
    subscriptionsUpdated
  });
}
