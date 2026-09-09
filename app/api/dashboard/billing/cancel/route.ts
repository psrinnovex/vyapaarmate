import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireBusinessSession("business:billing:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { id: true, subscriptionStatus: true }
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (business.subscriptionStatus !== "ACTIVE" && business.subscriptionStatus !== "TRIAL") {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });
  }

  await prisma.business.update({
    where: { id: session.businessId },
    data: {
      subscriptionStatus: "CANCELLED"
    }
  });

  await prisma.subscription.updateMany({
    where: {
      businessId: session.businessId,
      status: "ACTIVE"
    },
    data: {
      status: "CANCELLED"
    }
  });

  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "SUBSCRIPTION_CANCELLED",
    entity: "Business",
    entityId: session.businessId,
    metadata: { source: "DASHBOARD" }
  });

  return NextResponse.json({ cancelled: true });
}
