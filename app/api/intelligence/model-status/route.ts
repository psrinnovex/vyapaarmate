import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { canManageIntelligenceModels } from "@/lib/intelligence/ml/access";
import { getModelStatusPayload } from "@/lib/intelligence/ml/training-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  if (!canManageIntelligenceModels(session, businessId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    return NextResponse.json(await getModelStatusPayload(businessId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intelligence model status is unavailable" },
      { status: 500 }
    );
  }
}
