import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payments = await prisma.payment.findMany({
    where: { provider: "UPI", status: { in: ["PENDING", "FAILED"] }, order: { status: { not: "CANCELLED" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      business: { select: { id: true, name: true } },
      order: {
        select: {
          orderNumber: true,
          publicToken: true,
          customer: { select: { name: true, phone: true } }
        }
      }
    }
  });

  return NextResponse.json({
    payments: payments.map((payment) => ({
      id: payment.id,
      orderNumber: payment.order.orderNumber,
      orderUrl: `/order/${payment.order.publicToken}`,
      businessId: payment.business.id,
      businessName: payment.business.name,
      customerName: payment.order.customer.name,
      customerPhone: payment.order.customer.phone,
      amount: Number(payment.amount),
      status: payment.status,
      expiresAt: payment.paymentRequestExpiresAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString()
    }))
  });
}
