import { NextResponse } from "next/server";
import { fulfillmentFeeForOrder, fulfillmentModesFromFlags } from "@/lib/business-rules";
import { buildOrderCouponBreakdown, validateBusinessCoupon } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { orderCouponPreviewSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const bucket = await rateLimit(`coupon-preview:${getClientIp(request)}`, 30, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many coupon checks. Try again shortly." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = orderCouponPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { slug: parsed.data.businessSlug },
    select: {
      id: true,
      isActive: true,
      isVerified: true,
      subscriptionStatus: true,
      kycStatus: true,
      businessType: true,
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true,
      deliveryFee: true
    }
  });

  if (!business || !business.isActive || !business.isVerified || business.subscriptionStatus !== "ACTIVE" || business.kycStatus !== "APPROVED") {
    return NextResponse.json({ error: "This business is not accepting coupon checks right now." }, { status: 403 });
  }

  const coupon = await prisma.businessCoupon.findUnique({
    where: {
      businessId_code: {
        businessId: business.id,
        code: parsed.data.couponCode
      }
    }
  });

  const validation = validateBusinessCoupon(coupon, parsed.data.subtotal);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const fulfillmentModes = fulfillmentModesFromFlags({
    businessType: business.businessType,
    acceptsPickup: business.acceptsPickup,
    acceptsDineIn: business.acceptsDineIn,
    acceptsServiceAtLocation: business.acceptsServiceAtLocation
  });
  const orderType =
    parsed.data.orderType && fulfillmentModes.includes(parsed.data.orderType)
      ? parsed.data.orderType
      : fulfillmentModes[0] ?? "PICKUP";
  const breakdown = buildOrderCouponBreakdown({
    subtotal: parsed.data.subtotal,
    serviceFee: fulfillmentFeeForOrder({
      fee: Number(business.deliveryFee),
      orderType,
      fulfillmentModes,
      hasItems: parsed.data.subtotal > 0
    }),
    coupon: validation.coupon
  });

  return NextResponse.json({
    coupon: {
      id: validation.coupon.id,
      description: validation.coupon.description,
      discountType: validation.coupon.discountType,
      discountValue: Number(validation.coupon.discountValue),
      maxDiscountAmount: validation.coupon.maxDiscountAmount === null ? null : Number(validation.coupon.maxDiscountAmount),
      minimumOrderAmount: Number(validation.coupon.minimumOrderAmount)
    },
    breakdown
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
