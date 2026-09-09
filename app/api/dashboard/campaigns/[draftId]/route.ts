import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const auth = await requireBusinessSession("business:customers:write");
  if (auth.response) return auth.response;
  const parsed = await parseJsonRequest(request, z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(1200) }));
  if (parsed.response) return parsed.response;
  const { draftId } = await params;
  const draft = await prisma.$transaction(async tx => {
    const updated = await tx.campaignDraft.updateMany({ where: { id: draftId, businessId: auth.session.businessId }, data: parsed.data });
    if (!updated.count) return null;
    await tx.auditLog.create({ data: { userId: auth.session.id, businessId: auth.session.businessId, action: "CAMPAIGN_DRAFT_UPDATED", entity: "CampaignDraft", entityId: draftId } });
    return tx.campaignDraft.findUnique({ where: { id: draftId } });
  });
  return NextResponse.json(draft ? { draft, deliveryEnabled: false } : { error: "Draft not found" }, { status: draft ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const auth = await requireBusinessSession("business:customers:write");
  if (auth.response) return auth.response;
  const { draftId } = await params;
  const count = await prisma.$transaction(async tx => {
    const removed = await tx.campaignDraft.deleteMany({ where: { id: draftId, businessId: auth.session.businessId } });
    if (removed.count) await tx.auditLog.create({ data: { userId: auth.session.id, businessId: auth.session.businessId, action: "CAMPAIGN_DRAFT_DELETED", entity: "CampaignDraft", entityId: draftId } });
    return removed.count;
  });
  return NextResponse.json(count ? { deletedId: draftId } : { error: "Draft not found" }, { status: count ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
}
