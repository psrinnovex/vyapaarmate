import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:customers:write");
  if (auth.response) return auth.response;
  const { session } = auth;
  const businessId = session.businessId;

  const { customerId } = await context.params;
  const deleted = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, name: true, phone: true }
    });

    if (!customer) return null;

    const messages = await tx.whatsappMessage.deleteMany({
      where: { businessId, customerId: customer.id }
    });
    const orders = await tx.order.deleteMany({
      where: { businessId, customerId: customer.id }
    });
    await tx.customer.delete({ where: { id: customer.id } });

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      deletedOrders: orders.count,
      deletedMessages: messages.count
    };
  });

  if (!deleted) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  await writeAuditLog({
    userId: session.id,
    businessId,
    action: "CUSTOMER_DELETED",
    entity: "Customer",
    entityId: deleted.id,
    metadata: {
      name: deleted.name,
      phone: deleted.phone,
      deletedOrders: deleted.deletedOrders,
      deletedMessages: deleted.deletedMessages
    }
  });

  return NextResponse.json(deleted);
}
