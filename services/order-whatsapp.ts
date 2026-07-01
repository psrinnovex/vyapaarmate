import type { Prisma } from "@prisma/client";
import { formatINR } from "@/lib/utils";
import { getOrderTrackingStatusLabel } from "@/lib/order-tracking";
import { businessWhatsappConfig } from "@/services/business-whatsapp";
import { sendWhatsAppTemplate } from "@/services/whatsapp";
import { prisma } from "@/lib/prisma";

type OrderForWhatsapp = Prisma.OrderGetPayload<{
  include: { business: true; customer: true; items: true; payment: true };
}>;

function statusLabel(order: OrderForWhatsapp) {
  return getOrderTrackingStatusLabel(order.business.businessType, order.orderType, order.status).toLowerCase();
}

function paymentLabel(order: OrderForWhatsapp) {
  if (order.paymentStatus === "COMPLETED") return "Payment completed";
  if (order.paymentStatus === "REFUNDED") return "Payment refunded because the order was cancelled";
  if (order.paymentStatus === "FAILED") return "Online payment failed. Open the invoice to retry";
  if (order.payment?.provider === "CASH") return "Cash payment due";
  if (order.payment?.provider === "UPI") return "PSHR Innovex UPI payment awaiting admin bank verification";
  return "Online payment pending on website";
}

export async function sendOrderWhatsappUpdate(input: { businessId: string; orderId: string }) {
  const order = await prisma.order.findFirst({
    where: {
      businessId: input.businessId,
      OR: [{ id: input.orderId }, { orderNumber: input.orderId }]
    },
    include: { business: true, customer: true, items: true, payment: true }
  });

  if (!order) return { sent: false, reason: "not_found" as const };
  if (!order.customer.whatsappOptIn) return { sent: false, reason: "customer_not_opted_in" as const };
  const whatsappConfig = businessWhatsappConfig(order.business);
  if (!whatsappConfig.liveSendsEnabled) return { sent: false, reason: "business_whatsapp_not_live" as const };

  try {
    const result = await sendWhatsAppTemplate({
      phone: order.customer.phone,
      templateName: "order_status_update",
      variables: [
        order.customer.name,
        order.orderNumber,
        statusLabel(order),
        order.business.name,
        formatINR(Number(order.totalAmount)),
        paymentLabel(order)
      ],
      config: whatsappConfig
    });

    await prisma.whatsappMessage.create({
      data: {
        businessId: order.businessId,
        customerId: order.customerId,
        orderId: order.id,
        templateName: "order_status_update",
        phone: order.customer.phone,
        providerMessageId: result.messageId,
        status: result.status === "placeholder" ? "QUEUED" : "SENT",
        sentAt: result.status === "placeholder" ? null : new Date()
      }
    });

    return { sent: true, status: result.status, orderNumber: order.orderNumber };
  } catch (error) {
    await prisma.whatsappMessage.create({
      data: {
        businessId: order.businessId,
        customerId: order.customerId,
        orderId: order.id,
        templateName: "order_status_update",
        phone: order.customer.phone,
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "WhatsApp update failed."
      }
    });

    return { sent: false, reason: "send_failed" as const, orderNumber: order.orderNumber };
  }
}
