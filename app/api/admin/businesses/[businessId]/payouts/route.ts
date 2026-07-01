import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sendBusinessPayoutEmail } from "@/services/business-payout-email";
import { recordBusinessPayout } from "@/services/business-wallet";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

const payoutSchema = z.object({
  method: z.string().trim().min(2).max(80).default("BANK_TRANSFER"),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal(""))
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = payoutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { businessId } = await context.params;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true }
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    const result = await recordBusinessPayout({
      businessId: business.id,
      method: parsed.data.method,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null
    });

    await writeAuditLog({
      userId: session.id,
      businessId: business.id,
      action: "BUSINESS_WALLET_PAYOUT_RECORDED",
      entity: "BusinessPayout",
      entityId: result.payout.id,
      metadata: {
        businessName: business.name,
        amount: Number(result.payout.amount),
        method: result.payout.method,
        reference: result.payout.reference,
        settledCreditCount: result.settledCreditCount
      }
    });

    const payoutEmail = await sendBusinessPayoutEmail(result.payout.id, { actorUserId: session.id });

    return NextResponse.json({
      payout: {
        id: result.payout.id,
        amount: Number(result.payout.amount),
        status: result.payout.status,
        method: result.payout.method,
        reference: result.payout.reference,
        paidAt: result.payout.paidAt?.toISOString() ?? null,
        settledCreditCount: result.settledCreditCount
      },
      payoutEmail
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record this payout.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
