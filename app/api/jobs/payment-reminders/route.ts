import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCronRequest } from "@/lib/security/cron";
import { formatINR } from "@/lib/utils";
import { businessWhatsappConfig } from "@/services/business-whatsapp";
import { paymentCheckoutExpiresInMinutes } from "@/services/cashfree";
import { sendWhatsAppTemplate } from "@/services/whatsapp";

export const dynamic = "force-dynamic";

const TEMPLATE_NAME = "payment_pending_reminder";

function boundedMinutes(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function reminderAfterMinutes() {
  return boundedMinutes(process.env.PAYMENT_REMINDER_AFTER_MINUTES, 5, 1, 60);
}

function qrExpiryMinutes() {
  return paymentCheckoutExpiresInMinutes();
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function handlePaymentReminders(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const reminderMinutes = reminderAfterMinutes();
  const expiryMinutes = qrExpiryMinutes();
  const expiresBefore = new Date(Date.now() + Math.max(0, expiryMinutes - reminderMinutes) * 60_000);

  const payments = await prisma.payment.findMany({
    where: {
      provider: { in: ["CASHFREE", "UPI"] },
      status: "PENDING",
      paymentRequestUrl: { not: null },
      paymentReminderSentAt: null,
      paymentRequestExpiresAt: {
        gt: now,
        lte: expiresBefore
      },
      order: {
        status: { not: "CANCELLED" },
        paymentStatus: "PENDING",
        customer: { whatsappOptIn: true },
        business: {
          whatsappConnected: true,
          whatsappLiveEnabled: true
        }
      }
    },
    orderBy: { paymentRequestExpiresAt: "asc" },
    take: 50,
    include: {
      order: {
        include: {
          business: true,
          customer: true,
          items: true
        }
      }
    }
  });

  let sent = 0;
  let failed = 0;

  for (const payment of payments) {
    const { business, customer } = payment.order;
    const orderUrl = `${appUrl()}/order/${payment.order.publicToken}`;

    try {
      const result = await sendWhatsAppTemplate({
        phone: customer.phone,
        templateName: TEMPLATE_NAME,
        variables: [customer.name, payment.order.orderNumber, formatINR(Number(payment.amount)), orderUrl],
        config: businessWhatsappConfig(business)
      });
      await prisma.$transaction([
        prisma.whatsappMessage.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            orderId: payment.orderId,
            templateName: TEMPLATE_NAME,
            phone: customer.phone,
            providerMessageId: result.messageId,
            status: result.status === "placeholder" ? "QUEUED" : "SENT",
            sentAt: result.status === "placeholder" ? null : new Date()
          }
        }),
        prisma.payment.update({
          where: { id: payment.id },
          data: { paymentReminderSentAt: new Date() }
        })
      ]);
      sent += 1;
    } catch (error) {
      await prisma.whatsappMessage.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          orderId: payment.orderId,
          templateName: TEMPLATE_NAME,
          phone: customer.phone,
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Payment reminder failed."
        }
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    checked: payments.length,
    sent,
    failed,
    reminderAfterMinutes: reminderMinutes,
    qrExpiryMinutes: expiryMinutes
  });
}

export function GET(request: Request) {
  return handlePaymentReminders(request);
}

export function POST(request: Request) {
  return handlePaymentReminders(request);
}
