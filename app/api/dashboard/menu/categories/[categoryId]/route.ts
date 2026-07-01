import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:menu:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const { categoryId } = await context.params;
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, businessId: session.businessId },
    include: { _count: { select: { items: true } } }
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await prisma.menuCategory.delete({ where: { id: category.id } });
  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "MENU_CATEGORY_DELETED",
    entity: "MenuCategory",
    entityId: category.id,
    metadata: { name: category.name, itemCount: category._count.items }
  });

  return NextResponse.json({ deletedId: category.id, deletedItems: category._count.items });
}
