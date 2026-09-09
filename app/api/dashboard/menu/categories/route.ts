import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { menuCategorySchema } from "@/lib/validations";
import { parseJsonRequest } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

function mapCategory(category: {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { items: number };
}) {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    itemCount: category._count?.items ?? 0
  };
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:menu:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const parsed = await parseJsonRequest(request, menuCategorySchema);
  if (parsed.response) return parsed.response;

  const business = await prisma.business.findUnique({ where: { id: session.businessId }, select: { dataOrigin: true } });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const maxSort = await prisma.menuCategory.aggregate({
    where: { businessId: session.businessId },
    _max: { sortOrder: true }
  });

  try {
    const category = await prisma.menuCategory.create({
      data: {
        businessId: session.businessId,
        dataOrigin: business.dataOrigin,
        trainingEligible: business.dataOrigin === "LIVE",
        name: parsed.data.name,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,

      },
      include: { _count: { select: { items: true } } }
    });

    await writeAuditLog({
      userId: session.id,
      businessId: session.businessId,
      action: "MENU_CATEGORY_CREATED",
      entity: "MenuCategory",
      entityId: category.id
    });

    return NextResponse.json({ category: mapCategory(category) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }
}
