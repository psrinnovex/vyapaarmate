import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { canManageIntelligenceModels } from "@/lib/intelligence/ml/access";
import { isIntelligenceModelType } from "@/lib/intelligence/ml/model-registry";
import { trainIntelligenceModels } from "@/lib/intelligence/ml/training-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type TrainRequestBody = {
  businessId?: unknown;
  modelType?: unknown;
};

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as TrainRequestBody;
  const businessId = typeof body.businessId === "string" ? body.businessId : null;
  const modelType = body.modelType ?? "all";

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  if (!canManageIntelligenceModels(session, businessId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (modelType !== "all" && !isIntelligenceModelType(modelType)) {
    return NextResponse.json({ error: "Invalid modelType" }, { status: 400 });
  }

  try {
    const result = await trainIntelligenceModels({
      businessId,
      modelType: modelType === "all" ? "all" : modelType
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intelligence training failed" },
      { status: 500 }
    );
  }
}
