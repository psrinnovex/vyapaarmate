import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { canAccessBusiness } from "@/lib/security/authz";
import { currentPaidSubscriptionWhere } from "@/lib/subscription-access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

function isPublicBusinessAsset(business: {
  isActive: boolean;
  isVerified: boolean;
  subscriptionStatus: string;
  kycStatus: string;
  subscriptions: Array<{ id: string; endDate: Date }>;
}) {
  return (
    business.isActive &&
    business.isVerified &&
    business.subscriptionStatus === "ACTIVE" &&
    business.subscriptions.length > 0 &&
    business.kycStatus === "APPROVED"
  );
}

function publicAssetCacheControl(business: { subscriptions: Array<{ endDate: Date }> }, now: Date) {
  const endDate = business.subscriptions[0]?.endDate;
  const remainingSeconds = endDate ? Math.floor((endDate.getTime() - now.getTime()) / 1000) : 0;
  return `public, max-age=${Math.max(0, Math.min(86_400, remainingSeconds))}, must-revalidate`;
}

export async function GET(request: Request, context: RouteContext) {
  const { businessId } = await context.params;
  const now = new Date();
  const image = await prisma.businessImage.findUnique({
    where: { businessId },
    select: {
      data: true,
      mimeType: true,
      updatedAt: true,
      business: {
        select: {
          id: true,
          isActive: true,
          isVerified: true,
          subscriptionStatus: true,
          kycStatus: true,
          subscriptions: {
            where: currentPaidSubscriptionWhere(now),
            orderBy: { endDate: "desc" },
            select: { id: true, endDate: true },
            take: 1
          }
        }
      }
    }
  });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const publicAsset = isPublicBusinessAsset(image.business);
  if (!publicAsset) {
    const session = await getSessionUser();
    if (!session || !canAccessBusiness(session, image.business.id)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
  }

  const etag = `"${businessId}-${image.updatedAt.getTime()}"`;
  const cacheControl = publicAsset
    ? publicAssetCacheControl(image.business, now)
    : "private, max-age=60";
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": cacheControl,
      ETag: etag,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
