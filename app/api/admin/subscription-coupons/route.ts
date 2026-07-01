import { NextResponse } from "next/server";
import type { PlatformSubscriptionCoupon } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { platformSubscriptionCouponSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

function serializeCoupon(coupon: PlatformSubscriptionCoupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
    minimumAmount: Number(coupon.minimumAmount),
    plan: coupon.plan,
    redemptionLimit: coupon.redemptionLimit,
    redeemedCount: coupon.redeemedCount,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString()
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const coupons = await prisma.platformSubscriptionCoupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
  });

  return NextResponse.json(
    { coupons: coupons.map(serializeCoupon) },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = platformSubscriptionCouponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const coupon = await prisma.platformSubscriptionCoupon.create({
      data: {
        code: parsed.data.code,
        description: parsed.data.description ?? null,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        maxDiscountAmount: parsed.data.maxDiscountAmount ?? null,
        minimumAmount: parsed.data.minimumAmount,
        plan: parsed.data.plan ?? null,
        redemptionLimit: parsed.data.redemptionLimit ?? null,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive
      }
    });

    await writeAuditLog({
      userId: session.id,
      action: "PLATFORM_SUBSCRIPTION_COUPON_CREATED",
      entity: "PlatformSubscriptionCoupon",
      entityId: coupon.id,
      metadata: { code: coupon.code, plan: coupon.plan, discountType: coupon.discountType, discountValue: Number(coupon.discountValue) }
    });

    return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A subscription coupon with this code already exists." }, { status: 409 });
    }
    throw error;
  }
}
