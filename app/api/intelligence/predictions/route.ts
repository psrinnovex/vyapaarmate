import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { canManageIntelligenceModels } from "@/lib/intelligence/ml/access";
import { getPredictionsOrFallback } from "@/lib/intelligence/ml/prediction-service";

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
    return NextResponse.json(await getPredictionsOrFallback(businessId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intelligence predictions are unavailable" },
      { status: 500 }
    );
  }
}
