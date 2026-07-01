import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { getMenuItemImageUrl } from "@/lib/menu-item-image";
import { parseMenuItemImageDataUrl } from "@/lib/menu-item-image.server";
import { prisma } from "@/lib/prisma";
import { menuItemSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

type MenuItemWithDisplayImage = Prisma.MenuItemGetPayload<{
  include: { category: true; image: { select: { updatedAt: true } } };
}>;

function mapMenuItem(item: MenuItemWithDisplayImage) {
  return {
    id: item.id,
    categoryId: item.categoryId,
    category: item.category.name,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    foodType: item.foodType,
    imageUrl: getMenuItemImageUrl(item),
    isAvailable: item.isAvailable,
    isBestSeller: item.isBestSeller
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:menu:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = menuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { itemId } = await context.params;
  const [existing, category] = await Promise.all([
    prisma.menuItem.findFirst({ where: { id: itemId, businessId: session.businessId }, select: { id: true } }),
    prisma.menuCategory.findFirst({
      where: { id: parsed.data.categoryId, businessId: session.businessId },
      select: { id: true }
    })
  ]);

  if (!existing) {
    return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
  }
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  let image;
  try {
    image = typeof parsed.data.imageDataUrl === "string"
      ? parseMenuItemImageDataUrl(parsed.data.imageDataUrl)
      : undefined;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid image" }, { status: 400 });
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.menuItem.update({
      where: { id: existing.id },
      data: {
        categoryId: category.id,
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        foodType: parsed.data.foodType,
        isAvailable: parsed.data.isAvailable,
        isBestSeller: parsed.data.isBestSeller,
        ...(parsed.data.imageDataUrl === undefined ? {} : { imageUrl: null })
      }
    });

    if (parsed.data.imageDataUrl === null) {
      await transaction.menuItemImage.deleteMany({ where: { menuItemId: existing.id } });
    } else if (image) {
      await transaction.menuItemImage.upsert({
        where: { menuItemId: existing.id },
        create: { menuItemId: existing.id, ...image },
        update: image
      });
    }
  });

  const item = await prisma.menuItem.findUniqueOrThrow({
    where: { id: existing.id },
    include: { category: true, image: { select: { updatedAt: true } } }
  });

  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "MENU_ITEM_UPDATED",
    entity: "MenuItem",
    entityId: item.id
  });

  return NextResponse.json({ item: mapMenuItem(item) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:menu:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const { itemId } = await context.params;
  const existing = await prisma.menuItem.findFirst({
    where: { id: itemId, businessId: session.businessId },
    select: { id: true, name: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
  }

  await prisma.menuItem.delete({ where: { id: existing.id } });
  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "MENU_ITEM_DELETED",
    entity: "MenuItem",
    entityId: existing.id,
    metadata: { name: existing.name }
  });

  return NextResponse.json({ deletedId: existing.id });
}
