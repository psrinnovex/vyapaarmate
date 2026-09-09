import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { getMenuItemImageUrl } from "@/lib/menu-item-image";
import { parseMenuItemImageDataUrl } from "@/lib/menu-item-image.server";
import { prisma } from "@/lib/prisma";
import { menuItemSchema } from "@/lib/validations";
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
    isBestSeller: item.isBestSeller,
    appointmentEnabled: item.appointmentEnabled,
    durationMinutes: item.durationMinutes,
    bufferMinutes: item.bufferMinutes
  };
}

export async function GET() {
  const auth = await requireBusinessSession("business:menu:read");
  if (auth.response) return auth.response;
  const { session } = auth;

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { businessId: session.businessId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } }
    }),
    prisma.menuItem.findMany({
      where: { businessId: session.businessId },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: { category: true, image: { select: { updatedAt: true } } }
    })
  ]);

  return NextResponse.json({
    categories: categories.map(mapCategory),
    items: items.map(mapMenuItem)
  });
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:menu:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const parsed = await parseJsonRequest(request, menuItemSchema);
  if (parsed.response) return parsed.response;

  const category = await prisma.menuCategory.findFirst({
    where: { id: parsed.data.categoryId, businessId: session.businessId },
    select: { id: true, business: { select: { dataOrigin: true } } }
  });
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

  const item = await prisma.menuItem.create({
    data: {
      businessId: session.businessId,
      dataOrigin: category.business.dataOrigin,
      trainingEligible: category.business.dataOrigin === "LIVE",
      categoryId: category.id,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      foodType: parsed.data.foodType,
      isAvailable: parsed.data.isAvailable,
      isBestSeller: parsed.data.isBestSeller,
      appointmentEnabled: parsed.data.appointmentEnabled,
      durationMinutes: parsed.data.appointmentEnabled ? parsed.data.durationMinutes : null,
      bufferMinutes: parsed.data.appointmentEnabled ? parsed.data.bufferMinutes : 0,

      image: image ? { create: image } : undefined
    },
    include: { category: true, image: { select: { updatedAt: true } } }
  });

  if (item.appointmentEnabled) {
    const providers = await prisma.appointmentProvider.findMany({
      where: { businessId: session.businessId, isActive: true },
      select: { id: true }
    });
    if (providers.length) {
      await prisma.appointmentProviderService.createMany({
        data: providers.map((provider) => ({ providerId: provider.id, menuItemId: item.id })),
        skipDuplicates: true
      });
    }
  }

  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "MENU_ITEM_CREATED",
    entity: "MenuItem",
    entityId: item.id
  });

  return NextResponse.json({ item: mapMenuItem(item) }, { status: 201 });
}
