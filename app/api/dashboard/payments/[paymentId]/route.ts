import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { cashPaymentStatusSchema } from "@/lib/validations";
import { sendPaidOrderInvoiceEmail } from "@/services/order-invoice-email";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:payments:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const parsed = cashPaymentStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { paymentId } = await context.params;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId: session.businessId },
    include: { order: true }
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.provider !== "CASH") {
    return NextResponse.json({ error: "Only cash payments can be recorded by the business. PSHR UPI payments require super admin verification." }, { status: 409 });
  }
  if (payment.order.status === "CANCELLED") {
    return NextResponse.json({ error: "Cancelled orders cannot be marked paid." }, { status: 409 });
  }
  if (payment.status === "COMPLETED") {
    return NextResponse.json({ completed: true });
  }

  const paidAt = new Date();
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "COMPLETED", paidAt }
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "COMPLETED" }
    })
  ]);

  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "CASH_PAYMENT_COLLECTED",
    entity: "Payment",
    entityId: payment.id,
    metadata: { orderId: payment.orderId, orderNumber: payment.order.orderNumber, amount: Number(payment.amount) }
  });

  const [whatsapp, invoiceEmail] = await Promise.all([
    sendOrderWhatsappUpdate({ businessId: session.businessId, orderId: payment.orderId }),
    sendPaidOrderInvoiceEmail(payment.orderId).catch((error) => ({
      status: "failed" as const,
      reason: error instanceof Error ? error.message : "Invoice email failed."
    }))
  ]);

  return NextResponse.json({ completed: true, paidAt: paidAt.toISOString(), whatsapp, invoiceEmail });
}
