import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { orderStatusSchema } from "@/lib/validations";
import { getNoShowEligibility } from "@/lib/booking-outcomes";
import { cancelOrderPaymentForBusinessCancellation } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";
import { parseJsonRequest } from "@/lib/security/validation";

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

  const parsed = await parseJsonRequest(request, orderStatusSchema);
  if (parsed.response) return parsed.response;

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

  if (existing.status === parsed.data.status) {
    return NextResponse.json({ order: { id: existing.id, orderNumber: existing.orderNumber, status: existing.status,
      paymentStatus: existing.paymentStatus, updatedAt: existing.updatedAt }, idempotent: true });
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

  const isNoShow = parsed.data.outcome === "NO_SHOW";
  if (isNoShow) {
    const eligibility = getNoShowEligibility(existing);
    if (!eligibility.allowed) {
      const error =
        eligibility.reason === "missing_schedule"
          ? "This booking has no scheduled time, so it cannot be recorded as a no-show."
          : eligibility.reason === "before_schedule"
            ? "A no-show cannot be recorded before the scheduled appointment time."
            : eligibility.reason === "already_recorded"
              ? "This booking is already recorded as a no-show."
              : "Only an active, confirmed appointment can be recorded as a no-show.";
      return NextResponse.json({ error }, { status: 409 });
    }
  }

  let cancellation: Awaited<ReturnType<typeof cancelOrderPaymentForBusinessCancellation>> | null = null;
  if (parsed.data.status === "CANCELLED" && !isNoShow) {
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

  if (parsed.data.status === "CANCELLED" && !isNoShow && !cancellation) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const outcomeAt = new Date();
  let order;
  if (isNoShow) {
    order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: existing.id,
          businessId: session.businessId,
          status: { in: ["ACCEPTED", "PREPARING", "READY"] },
          scheduledFor: { lte: outcomeAt },
          noShowAt: null
        },
        data: {
          status: "CANCELLED",
          cancelledAt: outcomeAt,
          noShowAt: outcomeAt,
          cancellationReason: parsed.data.reason ?? "CUSTOMER_NO_SHOW"
        }
      });
      if (updated.count !== 1) return null;
      await tx.appointment.updateMany({
        where: { orderId: existing.id, status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] } },
        data: { status: "NO_SHOW", cancelledAt: outcomeAt, cancellationReason: parsed.data.reason ?? "CUSTOMER_NO_SHOW" }
      });
      return tx.order.findUniqueOrThrow({
        where: { id: existing.id },
        include: { customer: true, items: true, payment: true }
      });
    });
  } else if (parsed.data.status === "CANCELLED") {
    order = await prisma.order.update({
      where: { id: existing.id },
      data: {
        cancelledAt: outcomeAt,
        cancellationReason: parsed.data.reason ?? "CANCELLED_BY_BUSINESS"
      },
      include: { customer: true, items: true, payment: true }
    });
  } else {
    order = await prisma.$transaction(async (tx) => {
      const transition = await tx.order.updateMany({
        where: { id: existing.id, businessId: session.businessId, status: existing.status },
        data: { status: parsed.data.status, ...(parsed.data.status === "DELIVERED" ? { completedAt: outcomeAt } : {}) }
      });
      if (transition.count !== 1) return null;
      const appointmentStatus =
        parsed.data.status === "ACCEPTED"
          ? "CONFIRMED"
          : parsed.data.status === "PREPARING" || parsed.data.status === "READY"
            ? "IN_PROGRESS"
            : parsed.data.status === "DELIVERED"
              ? "COMPLETED"
              : null;
      if (appointmentStatus) {
        await tx.appointment.updateMany({
          where: { orderId: existing.id, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          data: {
            status: appointmentStatus,
            ...(appointmentStatus === "CONFIRMED" ? { confirmedAt: outcomeAt } : {}),
            ...(appointmentStatus === "COMPLETED" ? { completedAt: outcomeAt } : {})
          }
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: existing.id },
        include: { customer: true, items: true, payment: true }
      });
    });
  }
  if (!order) return NextResponse.json({ error: "This order changed while you were updating it. Refresh and try again." }, { status: 409 });
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
        outcome: isNoShow ? "NO_SHOW" : undefined,
        cancellationReason: order.cancellationReason,
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

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { dataOrigin: true } });
  if (!business || business.dataOrigin === "LIVE") {
    return NextResponse.json({ error: "Live order history cannot be deleted from the dashboard. Use cancellation to correct an order; contact support for account-data requests." }, { status: 409 });
  }

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
