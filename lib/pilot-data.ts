import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recurringSubscriptionValue, weeklyRepeatUseRate } from "@/lib/pilot-reporting";

export async function getPilotReport(now = new Date()) {
  const currentStart = new Date(now.getTime() - 7 * 86400000);
  const previousStart = new Date(now.getTime() - 14 * 86400000);
  const rows = await prisma.$queryRaw<Array<{
    cohort: string; enrolled: bigint; onboarded: bigint; activated: bigint;
    activeCurrent: bigint; activePrevious: bigint; activeBoth: bigint; merchantOrderValue: Prisma.Decimal;
  }>>(Prisma.sql`
    WITH enrolled AS (
      SELECT b."id", b."pilotCohort", b."setupCompletedAt",
        EXISTS (SELECT 1 FROM "Order" o WHERE o."businessId"=b."id" AND o."dataOrigin"='LIVE'
          AND o."status" <> 'CANCELLED' AND o."createdAt">=b."pilotEnrolledAt" AND o."createdAt"<${now}) AS activated,
        EXISTS (SELECT 1 FROM "Order" o WHERE o."businessId"=b."id" AND o."dataOrigin"='LIVE'
          AND o."status" <> 'CANCELLED' AND o."createdAt">=GREATEST(${currentStart}, b."pilotEnrolledAt") AND o."createdAt"<${now}) AS current_week,
        EXISTS (SELECT 1 FROM "Order" o WHERE o."businessId"=b."id" AND o."dataOrigin"='LIVE'
          AND o."status" <> 'CANCELLED' AND o."createdAt">=GREATEST(${previousStart}, b."pilotEnrolledAt") AND o."createdAt"<${currentStart}) AS previous_week,
        COALESCE((SELECT SUM(o."totalAmount") FROM "Order" o WHERE o."businessId"=b."id"
          AND o."dataOrigin"='LIVE' AND o."paymentStatus"='COMPLETED' AND o."status" <> 'CANCELLED'
          AND o."createdAt">=GREATEST(${currentStart}, b."pilotEnrolledAt") AND o."createdAt"<${now}),0) AS order_value
      FROM "Business" b WHERE b."pilotCohort" IS NOT NULL AND b."pilotEnrolledAt" <= ${now} AND b."dataOrigin"='LIVE'
    )
    SELECT "pilotCohort"::text AS cohort, COUNT(*) AS enrolled,
      COUNT(*) FILTER (WHERE "setupCompletedAt" IS NOT NULL) AS onboarded,
      COUNT(*) FILTER (WHERE activated) AS activated,
      COUNT(*) FILTER (WHERE current_week) AS "activeCurrent",
      COUNT(*) FILTER (WHERE previous_week) AS "activePrevious",
      COUNT(*) FILTER (WHERE current_week AND previous_week) AS "activeBoth",
      SUM(order_value) AS "merchantOrderValue"
    FROM enrolled GROUP BY "pilotCohort"
  `);
  const [subscriptions, businesses, excludedFixtures] = await Promise.all([
    prisma.subscription.findMany({
      where: { dataOrigin: "LIVE", status: "ACTIVE", paymentStatus: "COMPLETED", paidAt: { lte: now },
        startDate: { lte: now }, endDate: { gt: now },
        business: { dataOrigin: "LIVE", pilotCohort: { not: null }, pilotEnrolledAt: { lte: now } } },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      select: { businessId: true, subtotalAmount: true, discountAmount: true, amount: true, gstAmount: true, upgradeCreditAmount: true,
        business: { select: { pilotCohort: true } } }
    }),
    prisma.business.findMany({ orderBy: { name: "asc" }, take: 200,
      select: { id: true, name: true, city: true, state: true, dataOrigin: true, pilotCohort: true, pilotEnrolledAt: true } }),
    prisma.business.count({ where: { dataOrigin: { not: "LIVE" }, pilotCohort: { not: null } } })
  ]);
  const paidByBusiness = new Map<string, (typeof subscriptions)[number]>();
  for (const subscription of subscriptions) if (!paidByBusiness.has(subscription.businessId)) paidByBusiness.set(subscription.businessId, subscription);
  return {
    generatedAt: now.toISOString(), currentStart: currentStart.toISOString(), previousStart: previousStart.toISOString(),
    excludedFixtures,
    cohorts: (["BENGALURU", "ANDHRA_PRADESH"] as const).map(cohort => {
      const row = rows.find(item => item.cohort === cohort);
      const paid = [...paidByBusiness.values()].filter(item => item.business.pilotCohort === cohort);
      const previous = Number(row?.activePrevious ?? 0);
      const both = Number(row?.activeBoth ?? 0);
      return { cohort, enrolled: Number(row?.enrolled ?? 0), onboarded: Number(row?.onboarded ?? 0), activated: Number(row?.activated ?? 0),
        activeCurrent: Number(row?.activeCurrent ?? 0), activePrevious: previous, activeBoth: both,
        repeatUseRate: weeklyRepeatUseRate(both, previous), paidBusinesses: paid.length,
        recurringValue: Math.round(paid.reduce((sum, item) => sum + recurringSubscriptionValue(item), 0) * 100) / 100,
        merchantOrderValue: Number(row?.merchantOrderValue ?? 0) };
    }),
    businesses: businesses.map(item => ({ ...item, pilotEnrolledAt: item.pilotEnrolledAt?.toISOString() ?? null }))
  };
}

export type PilotReport = Awaited<ReturnType<typeof getPilotReport>>;
