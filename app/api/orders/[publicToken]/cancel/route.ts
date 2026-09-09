import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { cancelOrderPaymentForBusinessCancellation } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ publicToken: string }> };

export async function POST(request: Request, context: RouteContext) {
  const bucket = await rateLimit(`appointment-cancel:${getClientIp(request)}`, 5, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many cancellation attempts. Try again shortly." }, { status: 429 });
  }

  const session = await getSessionUser();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Sign in with the customer account used for this booking." }, { status: 401 });
  }

  const { publicToken } = await context.params;
  const [user, order] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true }
    }),
    prisma.order.findUnique({
      where: { publicToken },
      include: {
        customer: { select: { email: true, phone: true } },
        business: { select: { appointmentCancelNoticeMins: true } },
        appointment: true
      }
    })
  ]);

  if (!user || !order?.appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  const matchesEmail = Boolean(
    user.emailVerifiedAt && order.customer.email && user.email.toLowerCase() === order.customer.email.toLowerCase()
  );
  const matchesPhone = Boolean(user.phoneVerifiedAt && user.phone && user.phone === order.customer.phone);
  if (!matchesEmail && !matchesPhone) {
    return NextResponse.json({ error: "This appointment belongs to a different customer account." }, { status: 403 });
  }
  if (order.status === "CANCELLED" || order.appointment.status === "CANCELLED") {
    return NextResponse.json({ cancelled: true });
  }
  if (!["REQUESTED", "CONFIRMED"].includes(order.appointment.status)) {
    return NextResponse.json({ error: "This appointment can no longer be cancelled online." }, { status: 409 });
  }

  const cutoff = new Date(
    order.appointment.startsAt.getTime() - order.business.appointmentCancelNoticeMins * 60_000
  );
  if (new Date() > cutoff) {
    return NextResponse.json(
      { error: "The online cancellation window has closed. Contact the business directly." },
      { status: 409 }
    );
  }

  try {
    const cancellation = await cancelOrderPaymentForBusinessCancellation({
      businessId: order.businessId,
      orderId: order.id,
      cancelledByUserId: null
    });
    if (!cancellation) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    await Promise.all([
      writeAuditLog({
        businessId: order.businessId,
        action: "APPOINTMENT_CANCELLED_BY_CUSTOMER",
        entity: "Appointment",
        entityId: order.appointment.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerUserId: session.id,
          startsAt: order.appointment.startsAt.toISOString(),
          paymentAction: cancellation.paymentAction,
          walletAction: cancellation.walletAction
        }
      }),
      sendOrderWhatsappUpdate({ businessId: order.businessId, orderId: order.id })
    ]);

    return NextResponse.json({ cancelled: true, paymentAction: cancellation.paymentAction });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cancel this appointment." },
      { status: 502 }
    );
  }
}
