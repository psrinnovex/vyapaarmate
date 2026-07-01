import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { dashboardBusinessAddressSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireBusinessSession("business:billing:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = dashboardBusinessAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingBusiness = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { id: true }
  });
  if (!existingBusiness) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const business = await prisma.business.update({
    where: { id: session.businessId },
    data: parsed.data,
    select: {
      id: true,
      address: true,
      city: true,
      state: true
    }
  });

  await writeAuditLog({
    userId: session.id,
    businessId: business.id,
    action: "BUSINESS_BILLING_ADDRESS_UPDATED",
    entity: "Business",
    entityId: business.id,
    metadata: {
      addressUpdated: true
    }
  });

  return NextResponse.json({ business });
}
