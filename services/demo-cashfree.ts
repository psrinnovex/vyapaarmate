import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * In-process stand-in for the Cashfree PG API, used only when isDemoMode() is true.
 * It answers the same endpoints services/cashfree.ts calls, reading payment state from
 * our own database, so every real code path (checkout, status sync, refunds,
 * reconciliation) runs unchanged without network calls or credentials.
 */

type Json = Record<string, unknown>;

const demoId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

async function findDemoTarget(cashfreeOrderId: string) {
  const payment = await prisma.payment.findFirst({
    where: { cashfreeOrderId },
    select: { status: true, amount: true, cashfreeCfOrderId: true, cashfreePaymentId: true, paidAt: true, paymentRequestExpiresAt: true }
  });
  if (payment) return payment;

  const subscription = await prisma.subscription.findFirst({
    where: { cashfreeOrderId },
    select: {
      paymentStatus: true,
      amount: true,
      cashfreeCfOrderId: true,
      cashfreePaymentId: true,
      paidAt: true,
      paymentRequestExpiresAt: true
    }
  });
  if (!subscription) return null;

  const { paymentStatus, ...rest } = subscription;
  return { status: paymentStatus, ...rest };
}

export async function demoCashfreeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const body: Json = typeof init.body === "string" ? (JSON.parse(init.body) as Json) : {};
  const parts = path.split("?")[0].split("/").filter(Boolean);

  if (parts[0] !== "orders") throw new Error(`Demo payments do not support ${method} ${path}.`);

  if (method === "POST" && parts.length === 1) {
    return {
      order_id: String(body.order_id ?? demoId("vm_demo")),
      cf_order_id: demoId("demo_cf"),
      payment_session_id: demoId("demo_session"),
      order_status: "ACTIVE",
      order_expiry_time: typeof body.order_expiry_time === "string" ? body.order_expiry_time : new Date(Date.now() + 30 * 60_000).toISOString(),
      order_amount: body.order_amount,
      order_currency: body.order_currency ?? "INR"
    } as T;
  }

  const orderId = decodeURIComponent(parts[1] ?? "");
  const target = await findDemoTarget(orderId);
  if (!target) throw new Error("Demo payment order was not found.");

  const paid = target.status === "COMPLETED" || target.status === "REFUNDED";
  const amount = Number(target.amount);

  if (method === "GET" && parts.length === 2) {
    const expired = !paid && Boolean(target.paymentRequestExpiresAt && target.paymentRequestExpiresAt.getTime() <= Date.now());
    return {
      order_id: orderId,
      cf_order_id: target.cashfreeCfOrderId,
      order_status: paid ? "PAID" : expired ? "EXPIRED" : "ACTIVE",
      order_amount: amount,
      order_currency: "INR",
      order_expiry_time: target.paymentRequestExpiresAt?.toISOString()
    } as T;
  }

  if (method === "GET" && parts[2] === "payments") {
    const payments =
      paid && target.cashfreePaymentId
        ? [
            {
              cf_payment_id: target.cashfreePaymentId,
              payment_status: "SUCCESS",
              payment_amount: amount,
              payment_currency: "INR",
              payment_time: (target.paidAt ?? new Date()).toISOString()
            }
          ]
        : [];
    return payments as T;
  }

  if (method === "PATCH" && parts.length === 2) {
    return { order_id: orderId, cf_order_id: target.cashfreeCfOrderId, order_status: "TERMINATED" } as T;
  }

  if (method === "POST" && parts[2] === "refunds") {
    const now = new Date().toISOString();
    return {
      order_id: orderId,
      refund_id: String(body.refund_id ?? demoId("vmref")),
      cf_refund_id: demoId("demo_rf"),
      cf_payment_id: target.cashfreePaymentId,
      refund_amount: Number(body.refund_amount ?? amount),
      refund_currency: "INR",
      refund_note: body.refund_note,
      refund_status: "SUCCESS",
      status_description: "Demo refund processed instantly.",
      created_at: now,
      processed_at: now
    } as T;
  }

  throw new Error(`Demo payments do not support ${method} ${path}.`);
}
