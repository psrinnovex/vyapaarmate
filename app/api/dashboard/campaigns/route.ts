import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/security/validation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const draftSchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(1200) });

export async function GET() {
  const auth = await requireBusinessSession("business:customers:read");
  if (auth.response) return auth.response;
  const [drafts, eligibleCustomers] = await Promise.all([
    prisma.campaignDraft.findMany({ where: { businessId: auth.session.businessId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.customer.count({ where: { businessId: auth.session.businessId, marketingOptIn: true, whatsappOptIn: true } })
  ]);
  return NextResponse.json({ drafts, eligibleCustomers, deliveryEnabled: false }, { headers });
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:customers:write");
  if (auth.response) return auth.response;
  const parsed = await parseJsonRequest(request, draftSchema);
  if (parsed.response) return parsed.response;
  const draft = await prisma.$transaction(async tx => {
    const created = await tx.campaignDraft.create({ data: { ...parsed.data, businessId: auth.session.businessId } });
    await tx.auditLog.create({ data: { userId: auth.session.id, businessId: auth.session.businessId, action: "CAMPAIGN_DRAFT_CREATED", entity: "CampaignDraft", entityId: created.id } });
    return created;
  });
  return NextResponse.json({ draft, deliveryEnabled: false }, { status: 201, headers });
}
