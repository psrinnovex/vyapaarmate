import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { businessCouponPatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ couponId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:settings:write");
  if (auth.response) return auth.response;
  const { session } = auth;
  const { couponId } = await context.params;

  const body = await request.json();
  const parsed = businessCouponPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.businessCoupon.findFirst({
    where: { id: couponId, businessId: session.businessId }
  });
  if (!existing) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }

  const coupon = await prisma.businessCoupon.update({
    where: { id: existing.id },
    data: {
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
    businessId: session.businessId,
    action: "BUSINESS_COUPON_UPDATED",
    entity: "BusinessCoupon",
    entityId: coupon.id,
    metadata: { code: coupon.code, isActive: coupon.isActive }
  });

  return NextResponse.json({
    coupon: {
      id: coupon.id,
      code: coupon.code,
      isActive: coupon.isActive,
      redeemedCount: coupon.redeemedCount
    }
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:settings:write");
  if (auth.response) return auth.response;
  const { session } = auth;
  const { couponId } = await context.params;

  const existing = await prisma.businessCoupon.findFirst({
    where: { id: couponId, businessId: session.businessId },
    select: { id: true, code: true, redeemedCount: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }

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
    businessId: session.businessId,
    action: existing.redeemedCount > 0 ? "BUSINESS_COUPON_DEACTIVATED" : "BUSINESS_COUPON_DELETED",
    entity: "BusinessCoupon",
    entityId: existing.id,
    metadata: { code: existing.code, redeemedCount: existing.redeemedCount }
  });

  return NextResponse.json({ deleted: true, deactivated: existing.redeemedCount > 0 });
}
