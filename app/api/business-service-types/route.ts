import { NextResponse } from "next/server";
import { listBusinessServiceTypes } from "@/lib/business-service-types.server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const serviceTypes = await listBusinessServiceTypes(prisma);

  return NextResponse.json({ serviceTypes });
}
