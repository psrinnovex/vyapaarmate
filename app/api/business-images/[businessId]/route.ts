import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { canAccessBusiness } from "@/lib/security/authz";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

function isPublicBusinessAsset(business: {
  isActive: boolean;
  isVerified: boolean;
  subscriptionStatus: string;
  kycStatus: string;
}) {
  return business.isActive && business.isVerified && business.subscriptionStatus === "ACTIVE" && business.kycStatus === "APPROVED";
}

export async function GET(request: Request, context: RouteContext) {
  const { businessId } = await context.params;
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
          kycStatus: true
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
    ? "public, max-age=86400, stale-while-revalidate=604800"
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
