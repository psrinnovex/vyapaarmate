import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { platformSubscriptionCouponPatchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ couponId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { couponId } = await context.params;

  const parsed = platformSubscriptionCouponPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.platformSubscriptionCoupon.findUnique({ where: { id: couponId } });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  const coupon = await prisma.platformSubscriptionCoupon.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
      ...(parsed.data.discountType !== undefined ? { discountType: parsed.data.discountType } : {}),
      ...(parsed.data.discountValue !== undefined ? { discountValue: parsed.data.discountValue } : {}),
      ...(parsed.data.maxDiscountAmount !== undefined ? { maxDiscountAmount: parsed.data.maxDiscountAmount ?? null } : {}),
      ...(parsed.data.minimumAmount !== undefined ? { minimumAmount: parsed.data.minimumAmount } : {}),
      ...(parsed.data.plan !== undefined ? { plan: parsed.data.plan ?? null } : {}),
      ...(parsed.data.redemptionLimit !== undefined ? { redemptionLimit: parsed.data.redemptionLimit ?? null } : {}),
      ...(parsed.data.startsAt !== undefined ? { startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null } : {}),
      ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
    }
  });

  await writeAuditLog({
    userId: session.id,
    action: "PLATFORM_SUBSCRIPTION_COUPON_UPDATED",
    entity: "PlatformSubscriptionCoupon",
    entityId: coupon.id,
    metadata: { code: coupon.code, isActive: coupon.isActive, plan: coupon.plan }
  });

  return NextResponse.json({ coupon: { id: coupon.id, code: coupon.code, isActive: coupon.isActive } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { couponId } = await context.params;

  const existing = await prisma.platformSubscriptionCoupon.findUnique({
    where: { id: couponId },
    select: { id: true, code: true, redeemedCount: true }
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });

  if (existing.redeemedCount > 0) {
    await prisma.platformSubscriptionCoupon.update({ where: { id: existing.id }, data: { isActive: false } });
  } else {
    await prisma.platformSubscriptionCoupon.delete({ where: { id: existing.id } });
  }

  await writeAuditLog({
    userId: session.id,
    action: existing.redeemedCount > 0 ? "PLATFORM_SUBSCRIPTION_COUPON_DEACTIVATED" : "PLATFORM_SUBSCRIPTION_COUPON_DELETED",
    entity: "PlatformSubscriptionCoupon",
    entityId: existing.id,
    metadata: { code: existing.code, redeemedCount: existing.redeemedCount }
  });

  return NextResponse.json({ deleted: true, deactivated: existing.redeemedCount > 0 });
}
