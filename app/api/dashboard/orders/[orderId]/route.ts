import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { orderStatusSchema } from "@/lib/validations";
import { cancelOrderPaymentForBusinessCancellation } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

const orderStatusFlow = ["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERED"] as const;

function nextOrderStatus(status: string) {
  const index = orderStatusFlow.indexOf(status as (typeof orderStatusFlow)[number]);
  return index >= 0 ? orderStatusFlow[index + 1] ?? null : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:orders:update");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId } = await context.params;
  const existing = await prisma.order.findFirst({
    where: {
      businessId: session.businessId,
      OR: [{ id: orderId }, { orderNumber: orderId }]
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (existing.status === "CANCELLED" && parsed.data.status !== "CANCELLED") {
    return NextResponse.json({ error: "Cancelled orders cannot be reopened from the business dashboard." }, { status: 409 });
  }

  if (existing.status === "DELIVERED" && parsed.data.status !== "DELIVERED") {
    return NextResponse.json({ error: "Completed orders cannot be moved to another status." }, { status: 409 });
  }

  if (parsed.data.status !== "CANCELLED" && parsed.data.status !== nextOrderStatus(existing.status)) {
    return NextResponse.json({ error: "Bookings must move one step at a time. Refresh and use the next available action." }, { status: 409 });
  }

  let cancellation: Awaited<ReturnType<typeof cancelOrderPaymentForBusinessCancellation>> | null = null;
  if (parsed.data.status === "CANCELLED") {
    try {
      cancellation = await cancelOrderPaymentForBusinessCancellation({
        businessId: session.businessId,
        orderId: existing.id,
        cancelledByUserId: session.id
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not cancel and refund this payment. Try again." },
        { status: 502 }
      );
    }
  }

  if (parsed.data.status === "CANCELLED" && !cancellation) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = parsed.data.status === "CANCELLED"
    ? await prisma.order.findUniqueOrThrow({
        where: { id: existing.id },
        include: { customer: true, items: true, payment: true }
      })
    : await prisma.order.update({
        where: { id: existing.id },
        data: { status: parsed.data.status },
        include: { customer: true, items: true, payment: true }
      });
  const refundedAt = cancellation?.paymentAction === "refunded" ? cancellation.refundedAt.toISOString() : undefined;
  const [whatsapp] = await Promise.all([
    sendOrderWhatsappUpdate({ businessId: session.businessId, orderId: order.id }),
    writeAuditLog({
      userId: session.id,
      businessId: session.businessId,
      action: "ORDER_STATUS_UPDATED",
      entity: "Order",
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        previousStatus: existing.status,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentAction: cancellation?.paymentAction ?? "unchanged",
        walletAction: cancellation?.walletAction ?? "unchanged",
        providerRefund: cancellation && "providerRefund" in cancellation ? cancellation.providerRefund : undefined,
        providerTermination: cancellation && "providerTermination" in cancellation ? cancellation.providerTermination : undefined,
        providerTerminationError: cancellation && "providerTerminationError" in cancellation ? cancellation.providerTerminationError : undefined,
        refundedAt
      }
    }).catch((error) => {
      console.error("Order status audit log failed", error);
    })
  ]);

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt
    },
    whatsapp
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:orders:delete");
  if (auth.response) return auth.response;
  const { session } = auth;
  const businessId = session.businessId;

  const { orderId } = await context.params;
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({
      where: {
        businessId,
        OR: [{ id: orderId }, { orderNumber: orderId }]
      },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        totalAmount: true
      }
    });

    if (!existing) return null;

    await tx.order.delete({ where: { id: existing.id } });
    const remaining = await tx.order.aggregate({
      where: { businessId, customerId: existing.customerId },
      _count: { id: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true }
    });

    await tx.customer.update({
      where: { id: existing.customerId },
      data: {
        totalOrders: remaining._count.id,
        totalSpent: remaining._sum.totalAmount ?? 0,
        lastOrderAt: remaining._max.createdAt
      }
    });

    return {
      id: existing.id,
      orderNumber: existing.orderNumber,
      customerId: existing.customerId,
      totalAmount: Number(existing.totalAmount)
    };
  });

  if (!deleted) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await writeAuditLog({
    userId: session.id,
    businessId,
    action: "ORDER_DELETED",
    entity: "Order",
    entityId: deleted.id,
    metadata: {
      orderNumber: deleted.orderNumber,
      customerId: deleted.customerId,
      totalAmount: deleted.totalAmount
    }
  });

  return NextResponse.json({ deletedId: deleted.id, orderNumber: deleted.orderNumber });
}
