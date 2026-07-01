import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { orders: true, customers: true }
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return NextResponse.json({ businesses });
}
