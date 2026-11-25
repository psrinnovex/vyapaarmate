import { writeAuditLog } from "@/lib/audit";
import { subscriptionPlanAmounts } from "@/lib/billing";
import { demoAccountEmail, demoShopSlug, isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { currentPaidSubscriptionWhere } from "@/lib/subscription-access";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * DEMO_MODE only. Keeps the seeded demo shops presentable at any hour: setup marked
 * complete, KYC approved, open around the clock, a payout UPI on file and a current
 * paid subscription. It only ever touches the demo owner's business and the public demo
 * shop (NEXT_PUBLIC_DEMO_SHOP_SLUG) and is safe to call repeatedly.
 */
export async function prepareDemoWorkspace(businessId?: string | null) {
  if (!isDemoMode()) return;

  const owner = await prisma.user.findUnique({
    where: { email: demoAccountEmail("owner") },
    select: { businessId: true }
  });
  const shop = await prisma.business.findUnique({ where: { slug: demoShopSlug }, select: { id: true } });
  const allowed = new Set([owner?.businessId, shop?.id].filter((id): id is string => Boolean(id)));
  const targets = businessId ? [businessId].filter((id) => allowed.has(id)) : [...allowed];

  for (const id of targets) {
    await prepareBusiness(id);
  }
}

async function prepareBusiness(businessId: string) {
  const now = new Date();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, subscriptionPlan: true, setupCompletedAt: true, payoutUpiId: true, payoutUpiName: true }
  });
  if (!business) return;

  await prisma.business.update({
    where: { id: business.id },
    data: {
      setupCompletedAt: business.setupCompletedAt ?? now,
      subscriptionStatus: "ACTIVE",
      kycStatus: "APPROVED",
      isVerified: true,
      isActive: true,
      isOpen: true,
      businessHours: "Open today",
      ...(business.payoutUpiId ? {} : { payoutMethod: "UPI" as const, payoutUpiId: "demo.shop@upi", payoutUpiName: business.payoutUpiName ?? business.name })
    }
  });

  const current = await prisma.subscription.findFirst({
    where: { businessId: business.id, ...currentPaidSubscriptionWhere(now) },
    select: { id: true }
  });
  if (current) return;

  const amount = subscriptionPlanAmounts[business.subscriptionPlan];
  const taxable = Math.round((amount / 1.18) * 100) / 100;
  await prisma.subscription.create({
    data: {
      businessId: business.id,
      plan: business.subscriptionPlan,
      amount,
      subtotalAmount: taxable,
      taxableAmount: taxable,
      gstAmount: Math.round((amount - taxable) * 100) / 100,
      status: "ACTIVE",
      paymentStatus: "COMPLETED",
      paidAt: now,
      startDate: new Date(now.getTime() - DAY_MS),
      endDate: new Date(now.getTime() + 30 * DAY_MS),
      dataOrigin: "DEMO"
    }
  });

  await writeAuditLog({
    businessId: business.id,
    action: "DEMO_WORKSPACE_PREPARED",
    entity: "Business",
    entityId: business.id,
    metadata: { source: "demo_mode" }
  });
}
