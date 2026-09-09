import { NextResponse } from "next/server";
import { getMobileRequestSession } from "@/lib/api-session";
import { getPublicBusinessBySlug } from "@/lib/public-business";
import {
  hasRegulatedMobileItem,
  isMobilePhysicalServiceType,
  looksLikeRegulatedBusinessLabel
} from "@/lib/mobile-commerce-policy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authenticated = await getMobileRequestSession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (authenticated.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer account required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const { slug } = await context.params;
  const classification = await prisma.business.findUnique({
    where: { slug },
    select: {
      businessServiceType: { select: { slug: true } },
      menuItems: {
        where: { isAvailable: true },
        select: { name: true, category: { select: { name: true } } }
      }
    }
  });
  if (
    !classification ||
    !isMobilePhysicalServiceType(classification.businessServiceType?.slug) ||
    hasRegulatedMobileItem(
      classification.menuItems.map((item) => ({ name: item.name, category: item.category.name }))
    )
  ) {
    return NextResponse.json(
      { error: "This category is not available in the mobile app.", code: "MOBILE_CATEGORY_NOT_AVAILABLE" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  const business = await getPublicBusinessBySlug(slug);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (looksLikeRegulatedBusinessLabel(business.businessType)) {
    return NextResponse.json(
      { error: "This regulated category is not available in the mobile app.", code: "MOBILE_REGULATED_GOODS_NOT_AVAILABLE" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { business },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}
