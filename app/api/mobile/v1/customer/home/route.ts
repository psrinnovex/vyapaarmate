import { NextResponse } from "next/server";
import { getMobileRequestSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getCustomerPortalBusinessProfiles, getCustomerPortalOrders } from "@/lib/user-portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authenticated = await getMobileRequestSession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (authenticated.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer account required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const user = await prisma.user.findUnique({
    where: { id: authenticated.user.id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [bookings, businessProfiles] = await Promise.all([
    getCustomerPortalOrders(user),
    getCustomerPortalBusinessProfiles(user)
  ]);

  return NextResponse.json(
    {
      user,
      bookings,
      businessProfiles,
      generatedAt: new Date().toISOString()
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}
