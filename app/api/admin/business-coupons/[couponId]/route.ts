import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { adminBusinessCouponPatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ couponId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { couponId } = await context.params;

  const parsed = adminBusinessCouponPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.businessCoupon.findUnique({
    where: { id: couponId },
    select: { id: true, businessId: true }
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  if (parsed.data.businessId !== undefined) {
    const business = await prisma.business.findUnique({
      where: { id: parsed.data.businessId },
      select: { id: true }
    });
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  try {
    const coupon = await prisma.businessCoupon.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.businessId !== undefined ? { businessId: parsed.data.businessId } : {}),
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
        ...(parsed.data.discountType !== undefined ? { discountType: parsed.data.discountType } : {}),
        ...(parsed.data.discountValue !== undefined ? { discountValue: parsed.data.discountValue } : {}),
        ...(parsed.data.maxDiscountAmount !== undefined ? { maxDiscountAmount: parsed.data.maxDiscountAmount ?? null } : {}),
        ...(parsed.data.minimumOrderAmount !== undefined ? { minimumOrderAmount: parsed.data.minimumOrderAmount } : {}),
        ...(parsed.data.redemptionLimit !== undefined ? { redemptionLimit: parsed.data.redemptionLimit ?? null } : {}),
        ...(parsed.data.startsAt !== undefined ? { startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null } : {}),
        ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
      }
    });

    await writeAuditLog({
      userId: session.id,
      businessId: coupon.businessId,
      action: "ADMIN_BUSINESS_COUPON_UPDATED",
      entity: "BusinessCoupon",
      entityId: coupon.id,
      metadata: {
        code: coupon.code,
        isActive: coupon.isActive,
        previousBusinessId: existing.businessId
      }
    });

    return NextResponse.json({
      coupon: {
        id: coupon.id,
        businessId: coupon.businessId,
        code: coupon.code,
        isActive: coupon.isActive,
        redeemedCount: coupon.redeemedCount
      }
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This business already has a coupon with this code." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { couponId } = await context.params;

  const existing = await prisma.businessCoupon.findUnique({
    where: { id: couponId },
    select: { id: true, businessId: true, code: true, redeemedCount: true }
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  if (existing.redeemedCount > 0) {
    await prisma.businessCoupon.update({
      where: { id: existing.id },
      data: { isActive: false }
    });
  } else {
    await prisma.businessCoupon.delete({ where: { id: existing.id } });
  }

  await writeAuditLog({
    userId: session.id,
    businessId: existing.businessId,
    action: existing.redeemedCount > 0 ? "ADMIN_BUSINESS_COUPON_DEACTIVATED" : "ADMIN_BUSINESS_COUPON_DELETED",
    entity: "BusinessCoupon",
    entityId: existing.id,
    metadata: { code: existing.code, redeemedCount: existing.redeemedCount }
  });

  return NextResponse.json({ deleted: true, deactivated: existing.redeemedCount > 0 });
}
