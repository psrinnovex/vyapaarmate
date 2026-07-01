import { NextResponse } from "next/server";
import type { BusinessCoupon, Business } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { adminBusinessCouponSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type CouponWithBusiness = BusinessCoupon & {
  business: Pick<Business, "id" | "name" | "slug" | "ownerName" | "phone">;
};

function serializeCoupon(coupon: CouponWithBusiness) {
  return {
    id: coupon.id,
    businessId: coupon.businessId,
    business: coupon.business,
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

function serializeBusiness(business: Pick<Business, "id" | "name" | "slug" | "ownerName" | "phone" | "isActive" | "isVerified" | "subscriptionStatus" | "kycStatus">) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    ownerName: business.ownerName,
    phone: business.phone,
    isActive: business.isActive,
    isVerified: business.isVerified,
    subscriptionStatus: business.subscriptionStatus,
    kycStatus: business.kycStatus
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [coupons, businesses] = await Promise.all([
    prisma.businessCoupon.findMany({
      include: {
        business: {
          select: { id: true, name: true, slug: true, ownerName: true, phone: true }
        }
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    }),
    prisma.business.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        ownerName: true,
        phone: true,
        isActive: true,
        isVerified: true,
        subscriptionStatus: true,
        kycStatus: true
      },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }]
    })
  ]);

  return NextResponse.json(
    {
      coupons: coupons.map(serializeCoupon),
      businesses: businesses.map(serializeBusiness)
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = adminBusinessCouponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: parsed.data.businessId },
    select: { id: true, name: true }
  });
  if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  try {
    const coupon = await prisma.businessCoupon.create({
      data: {
        businessId: business.id,
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
      },
      include: {
        business: {
          select: { id: true, name: true, slug: true, ownerName: true, phone: true }
        }
      }
    });

    await writeAuditLog({
      userId: session.id,
      businessId: business.id,
      action: "ADMIN_BUSINESS_COUPON_CREATED",
      entity: "BusinessCoupon",
      entityId: coupon.id,
      metadata: {
        code: coupon.code,
        businessName: business.name,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue)
      }
    });

    return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This business already has a coupon with this code." }, { status: 409 });
    }
    throw error;
  }
}
