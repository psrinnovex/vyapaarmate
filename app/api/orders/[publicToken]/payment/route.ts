import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { cancelOrderPaymentForBusinessCancellation } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function POST() {
  return NextResponse.json(
    { error: "This payment request is locked. Place a fresh booking instead of reusing the same payment link." },
    { status: 410 }
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const bucket = await rateLimit(`payment-cancel:${getClientIp(request)}`, 5, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many payment cancellation attempts. Try again shortly." }, { status: 429 });
  }

  const { publicToken } = await context.params;
  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: { payment: true }
  });

  if (!order || !order.payment) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.payment.provider === "CASH") {
    return NextResponse.json({ error: "Cash payments do not have an online payment to cancel." }, { status: 409 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ cancelled: true });
  }
  if (order.payment.status === "COMPLETED" || order.paymentStatus === "COMPLETED") {
    return NextResponse.json({ error: "This payment is already verified. Contact the business for cancellation and refund." }, { status: 409 });
  }

  try {
    const cancellation = await cancelOrderPaymentForBusinessCancellation({
      businessId: order.businessId,
      orderId: order.id,
      cancelledByUserId: null
    });
    if (!cancellation) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await Promise.all([
      writeAuditLog({
        businessId: order.businessId,
        action: "ORDER_PAYMENT_CANCELLED_BY_CUSTOMER",
        entity: "Payment",
        entityId: order.payment.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: Number(order.totalAmount),
          paymentAction: cancellation.paymentAction,
          walletAction: cancellation.walletAction,
          providerTermination: "providerTermination" in cancellation ? cancellation.providerTermination : undefined,
          providerTerminationError: "providerTerminationError" in cancellation ? cancellation.providerTerminationError : undefined,
          cancelledAt: new Date().toISOString()
        }
      }),
      sendOrderWhatsappUpdate({ businessId: order.businessId, orderId: order.id })
    ]);

    return NextResponse.json({
      cancelled: true,
      order: cancellation.order,
      paymentAction: cancellation.paymentAction
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cancel this payment. Try again." },
      { status: 502 }
    );
  }
}
