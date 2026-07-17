import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { canManageIntelligenceModels } from "@/lib/intelligence/ml/access";
import { isIntelligenceModelType } from "@/lib/intelligence/ml/model-registry";
import { rollbackIntelligenceModel } from "@/lib/intelligence/ml/training-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RollbackRequestBody = {
  businessId?: unknown;
  modelType?: unknown;
  reason?: unknown;
};

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as RollbackRequestBody;
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  if (!isIntelligenceModelType(body.modelType)) {
    return NextResponse.json({ error: "Invalid modelType" }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });
  if (!canManageIntelligenceModels(session, businessId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await rollbackIntelligenceModel({
      businessId,
      modelType: body.modelType,
      reason: `Manual rollback by ${session.id}: ${reason}`
    });
    if (!result.rolledBack) return NextResponse.json(result, { status: 409 });

    await writeAuditLog({
      userId: session.id,
      businessId,
      action: "INTELLIGENCE_MODEL_ROLLED_BACK",
      entity: "IntelligenceModelArtifact",
      entityId: result.activeVersion,
      metadata: {
        modelType: body.modelType,
        previousVersion: result.activeVersion,
        restoredVersion: result.restoredVersion,
        reason
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intelligence rollback failed" },
      { status: 500 }
    );
  }
}
