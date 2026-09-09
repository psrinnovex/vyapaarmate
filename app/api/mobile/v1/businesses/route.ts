import { NextResponse } from "next/server";
import { getMobileRequestSession } from "@/lib/api-session";
import { getPublicBusinessListings } from "@/lib/public-businesses";
import {
  hasRegulatedMobileItem,
  isMobilePhysicalServiceType,
  looksLikeRegulatedBusinessLabel
} from "@/lib/mobile-commerce-policy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authenticated = await getMobileRequestSession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (authenticated.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer account required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 120) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const businesses = await getPublicBusinessListings({ query });
  const classifications = businesses.length
    ? await prisma.business.findMany({
        where: { id: { in: businesses.map((business) => business.id) } },
        select: {
          id: true,
          businessServiceType: { select: { slug: true } },
          menuItems: {
            where: { isAvailable: true },
            select: { name: true, category: { select: { name: true } } }
          }
        }
      })
    : [];
  const eligibleIds = new Set(
    classifications
      .filter((business) => {
        return (
          isMobilePhysicalServiceType(business.businessServiceType?.slug) &&
          !hasRegulatedMobileItem(
            business.menuItems.map((item) => ({ name: item.name, category: item.category.name }))
          )
        );
      })
      .map((business) => business.id)
  );
  const mobileBusinesses = businesses.filter(
    (business) => eligibleIds.has(business.id) && !looksLikeRegulatedBusinessLabel(business.businessType)
  );
  return NextResponse.json(
    { businesses: mobileBusinesses, query },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}
