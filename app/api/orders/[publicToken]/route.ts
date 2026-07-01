import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { liveStream } from "@/lib/live-data";
import { getPublicOrderReceipt } from "@/lib/order-receipt";
import type { LiveChangePayload } from "@/lib/postgres-live-events";
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

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

async function syncCashfreePayment(publicToken: string, options: { source?: string } = {}) {
  if (!isCashfreeConfigured()) return;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: { payment: true }
  });

  if (
    !order?.payment ||
    order.payment.provider !== "CASHFREE" ||
    !["PENDING", "FAILED"].includes(order.payment.status) ||
    !["PENDING", "FAILED"].includes(order.paymentStatus) ||
    !order.payment.cashfreeOrderId
  ) {
    return;
  }

  const status = await getCashfreeOrderStatus(order.payment.cashfreeOrderId).catch(() => null);
  if (!status) return;

  const settledAt = new Date();
  const cashfreeStatus = status.orderStatus ?? order.payment.cashfreeOrderStatus;
  const expiredLocally = Boolean(order.payment.paymentRequestExpiresAt && order.payment.paymentRequestExpiresAt.getTime() <= settledAt.getTime());

  if (!isCashfreePaidStatus(cashfreeStatus)) {
    if (!isCashfreeFailedStatus(cashfreeStatus) && !expiredLocally) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          cashfreeOrderStatus: cashfreeStatus,
          cashfreeCfOrderId: status.cfOrderId ?? order.payment.cashfreeCfOrderId,
          cashfreePaymentSessionId: status.paymentSessionId ?? order.payment.cashfreePaymentSessionId
        }
      });
      return;
    }

    const failureReason = expiredLocally
      ? "Cashfree did not receive a verified payment before the checkout expired."
      : "Cashfree reported that the payment checkout was not completed.";

    const failed = await failGatewayOrderPayment({
      paymentId: order.payment.id,
      provider: "CASHFREE",
      providerRequestId: order.payment.cashfreeOrderId,
      cashfreeCfOrderId: status.cfOrderId ?? order.payment.cashfreeCfOrderId,
      providerStatus: cashfreeStatus
    });
    if (!failed.updated) return;

    await Promise.all([
      writeAuditLog({
        userId: null,
        businessId: order.businessId,
        action: "ORDER_PAYMENT_FAILED",
        entity: "Payment",
        entityId: order.payment.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: Number(order.payment.amount),
          paymentRequestId: order.payment.cashfreeOrderId,
          cashfreeOrderStatus: cashfreeStatus,
          failureReason,
          failureSource: options.source ?? "cashfree_order_status_poll",
          failedAt: settledAt.toISOString()
        }
      }),
      sendOrderWhatsappUpdate({ businessId: order.businessId, orderId: order.id })
    ]);
    return;
  }

  const successfulPayment = await getCashfreeSuccessfulPayment(order.payment.cashfreeOrderId).catch(() => null);
  if (
    !successfulPayment ||
    !gatewayPaymentMatches({
      provider: "CASHFREE",
      expectedAmount: Number(order.payment.amount),
      receivedAmount: successfulPayment.amount,
      receivedCurrency: successfulPayment.currency
    })
  ) {
    return;
  }

  const completed = await completeGatewayOrderPayment({
    paymentId: order.payment.id,
    provider: "CASHFREE",
    providerPaymentId: successfulPayment.paymentId,
    providerRequestId: order.payment.cashfreeOrderId,
    cashfreeCfOrderId: status.cfOrderId ?? order.payment.cashfreeCfOrderId,
    providerStatus: cashfreeStatus,
    paidAt: successfulPayment.paidAt ?? settledAt
  });
  if (!completed.updated) return;
  const refundedAfterCancellation = "refunded" in completed && completed.refunded;

  await Promise.all([
    writeAuditLog({
      userId: null,
      businessId: order.businessId,
      action: refundedAfterCancellation ? "ORDER_PAYMENT_REFUNDED" : "ORDER_PAYMENT_CONFIRMED",
      entity: "Payment",
      entityId: order.payment.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: Number(order.payment.amount),
        paymentRequestId: order.payment.cashfreeOrderId,
        paymentId: successfulPayment.paymentId,
        cashfreeOrderStatus: cashfreeStatus,
        receivedAmount: successfulPayment.amount,
        receivedCurrency: successfulPayment.currency,
        source: "cashfree_order_status_poll",
        paidAt: settledAt.toISOString(),
        refundReason: refundedAfterCancellation ? "business_cancelled_order" : undefined
      }
    }),
    sendOrderWhatsappUpdate({ businessId: order.businessId, orderId: order.id })
  ]);
}

export async function GET(request: Request, context: RouteContext) {
  const { publicToken } = await context.params;
  const url = new URL(request.url);
  await syncCashfreePayment(publicToken, {
    source: url.searchParams.get("checkout") === "return" ? "cashfree_checkout_return" : "cashfree_order_status_poll"
  });
  const order = await getPublicOrderReceipt(publicToken);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";

  if (stream) {
    let queuedInitial = skipInitial ? null : order;
    const payload = async () => {
      if (queuedInitial) {
        const next = queuedInitial;
        queuedInitial = null;
        return next;
      }

      await syncCashfreePayment(publicToken);
      const nextOrder = await getPublicOrderReceipt(publicToken);
      if (!nextOrder) throw new Error("Order not found");
      return nextOrder;
    };

    return new Response(
      liveStream("order", payload, request.signal, {
        sendInitialPayload: !skipInitial,
        refreshIntervalMs: 30000,
        changeFilter: (change) => orderChangeMatches(publicToken, change)
      }),
      {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        }
      }
    );
  }

  return NextResponse.json(order, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function orderChangeMatches(publicToken: string, change: LiveChangePayload) {
  return change.publicToken === publicToken;
}
