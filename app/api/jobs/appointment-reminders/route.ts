import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCronRequest } from "@/lib/security/cron";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

function reminderWindowHours() {
  const parsed = Number(process.env.APPOINTMENT_REMINDER_HOURS ?? 24);
  return Number.isFinite(parsed) ? Math.min(168, Math.max(1, parsed)) : 24;
}

async function handleAppointmentReminders(request: Request) {
  const unauthorized = requireCronRequest(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const hours = reminderWindowHours();
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["REQUESTED", "CONFIRMED"] },
      reminderSentAt: null,
      startsAt: { gt: now, lte: until },
      order: {
        status: { not: "CANCELLED" },
        customer: { whatsappOptIn: true },
        business: { whatsappConnected: true, whatsappLiveEnabled: true }
      }
    },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: { id: true, businessId: true, orderId: true }
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const appointment of appointments) {
    const claimedAt = new Date();
    const claimed = await prisma.appointment.updateMany({
      where: { id: appointment.id, reminderSentAt: null },
      data: { reminderSentAt: claimedAt }
    });
    if (claimed.count === 0) {
      skipped += 1;
      continue;
    }

    try {
      const result = await sendOrderWhatsappUpdate({
        businessId: appointment.businessId,
        orderId: appointment.orderId
      });
      if (result.sent) {
        sent += 1;
      } else {
        skipped += 1;
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reminderSentAt: null }
        });
      }
    } catch {
      failed += 1;
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: null }
      });
    }
  }

  return NextResponse.json({ checked: appointments.length, sent, skipped, failed, reminderWindowHours: hours });
}

export function GET(request: Request) {
  return handleAppointmentReminders(request);
}

export function POST(request: Request) {
  return handleAppointmentReminders(request);
}
