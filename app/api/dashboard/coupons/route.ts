import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { businessCouponSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

function serializeCoupon(coupon: {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: { toString(): string };
  maxDiscountAmount: { toString(): string } | null;
  minimumOrderAmount: { toString(): string };
  redemptionLimit: number | null;
  redeemedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
    minimumOrderAmount: Number(coupon.minimumOrderAmount),
    redemptionLimit: coupon.redemptionLimit,
    redeemedCount: coupon.redeemedCount,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString()
  };
}

export async function GET() {
  const auth = await requireBusinessSession("business:settings:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const coupons = await prisma.businessCoupon.findMany({
    where: { businessId: session.businessId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
  });

  return NextResponse.json({ coupons: coupons.map(serializeCoupon) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:settings:write");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = businessCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const coupon = await prisma.businessCoupon.create({
      data: {
        businessId: session.businessId,
        code: parsed.data.code,
        description: parsed.data.description ?? null,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        maxDiscountAmount: parsed.data.maxDiscountAmount ?? null,
        minimumOrderAmount: parsed.data.minimumOrderAmount,
        redemptionLimit: parsed.data.redemptionLimit ?? null,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive
      }
    });

    await writeAuditLog({
      userId: session.id,
      businessId: session.businessId,
      action: "BUSINESS_COUPON_CREATED",
      entity: "BusinessCoupon",
      entityId: coupon.id,
      metadata: { code: coupon.code, discountType: coupon.discountType, discountValue: Number(coupon.discountValue) }
    });

    return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A coupon with this code already exists." }, { status: 409 });
    }
    throw error;
  }
}
