import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pendingUpiWhere = {
    paymentProvider: "UPI",
    paymentStatus: { in: ["PENDING", "FAILED"] }
  } satisfies Prisma.SubscriptionWhereInput;
  const [subscriptions, pendingPaymentCount] = await Promise.all([
    prisma.subscription.findMany({
      where: pendingUpiWhere,
      include: {
        business: { select: { id: true, name: true, ownerName: true, phone: true, email: true } }
      },
      orderBy: { createdAt: "asc" },
      take: 100
    }),
    prisma.subscription.count({ where: pendingUpiWhere })
  ]);

  return NextResponse.json({
    pendingPaymentCount,
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      reference: subscription.invoiceNumber ?? `SUB-${subscription.id.slice(-8).toUpperCase()}`,
      invoiceUrl: `/dashboard/billing/invoices/${subscription.id}`,
      businessId: subscription.business.id,
      businessName: subscription.business.name,
      ownerName: subscription.business.ownerName,
      ownerPhone: subscription.business.phone,
      ownerEmail: subscription.business.email,
      plan: subscription.plan,
      amount: Number(subscription.amount),
      paymentState: subscription.paymentStatus,
      expiresAt: subscription.paymentRequestExpiresAt?.toISOString() ?? null,
      createdAt: subscription.createdAt.toISOString()
    }))
  });
}
