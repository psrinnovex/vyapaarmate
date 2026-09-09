import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getPilotReport } from "../../lib/pilot-data";

// This check deliberately creates synthetic LIVE-tagged records to exercise the
// reporting filters. It is restricted to an explicitly named local test database.
const database = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || !/audit|test/.test(database.pathname)) {
  throw new Error("Pilot reporting integration requires a local database with audit or test in its name.");
}
const db = new PrismaClient();
const ids: string[] = [];
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * 86400000);
const prefix = `evidence-test-${randomUUID()}`;

async function main() {
  const before = await getPilotReport(now);
  for (const cohort of ["BENGALURU", "ANDHRA_PRADESH"] as const) {
    const business = await db.business.create({ data: {
      name: `Synthetic ${cohort}`, slug: `${prefix}-${cohort.toLowerCase()}`, ownerName: "Local Test",
      email: `${cohort.toLowerCase()}@example.test`, phone: cohort === "BENGALURU" ? "+15550109998" : "+15550109999", address: "Synthetic audit fixture",
      city: cohort === "BENGALURU" ? "Bengaluru" : "Tirupati", state: cohort === "BENGALURU" ? "Karnataka" : "Andhra Pradesh",
      businessType: "Tiffin Center", dataOrigin: "LIVE", pilotCohort: cohort, pilotEnrolledAt: ago(20), setupCompletedAt: ago(19)
    } });
    ids.push(business.id);
    const customer = await db.customer.create({ data: { businessId: business.id, name: "Synthetic customer", phone: "+15550109999", dataOrigin: "TEST", trainingEligible: false } });
    const order = (days: number, amount: number, extra = {}) => db.order.create({ data: {
      businessId: business.id, customerId: customer.id, orderNumber: `${prefix}-${randomUUID()}`, orderType: "PICKUP",
      subtotal: amount, totalAmount: amount, paymentStatus: "COMPLETED", status: "DELIVERED",
      dataOrigin: "LIVE", trainingEligible: false, createdAt: ago(days), ...extra
    } });
    await order(10, 180);
    if (cohort === "BENGALURU") await order(2, 360);
    await order(1, 9999, { dataOrigin: "TEST" });
    await order(1, 9999, { status: "CANCELLED" });
    await order(-1, 9999);
    await order(21, 9999);
    const sub = (extra = {}) => db.subscription.create({ data: {
      businessId: business.id, plan: "STARTER", status: "ACTIVE", paymentStatus: "COMPLETED", dataOrigin: "LIVE",
      subtotalAmount: 1499, discountAmount: 1199.2, gstAmount: 53.96, amount: 353.76,
      startDate: ago(5), endDate: ago(-25), paidAt: ago(5), ...extra
    } });
    if (cohort === "BENGALURU") {
      await sub();
      await sub({ paidAt: ago(10), subtotalAmount: 1000, discountAmount: 0 });
    }
    await sub({ paidAt: ago(-1) });
    await sub({ dataOrigin: "TEST", paidAt: ago(1) });
    await sub({ endDate: ago(1) });
    await sub({ startDate: ago(-1), endDate: ago(-31) });
  }
  const after = await getPilotReport(now);
  for (const cohort of ["BENGALURU", "ANDHRA_PRADESH"] as const) {
    const initial = before.cohorts.find(row => row.cohort === cohort)!;
    const actual = after.cohorts.find(row => row.cohort === cohort)!;
    const isBengaluru = cohort === "BENGALURU";
    for (const key of ["enrolled", "onboarded", "activated", "activePrevious"] as const) assert.equal(actual[key] - initial[key], 1, `${cohort} ${key}`);
    for (const key of ["activeCurrent", "activeBoth", "paidBusinesses"] as const) assert.equal(actual[key] - initial[key], isBengaluru ? 1 : 0, `${cohort} ${key}`);
    assert.equal(Math.round((actual.recurringValue - initial.recurringValue) * 100), isBengaluru ? 29980 : 0);
    assert.equal(actual.merchantOrderValue - initial.merchantOrderValue, isBengaluru ? 360 : 0);
  }
  console.log("PASS Both cohorts: onboarding, activation, weekly activity, paid-business deduplication, recurring value, and merchant order value.");
  console.log("PASS Test, cancelled, pre-enrollment, future, expired, and future-start records excluded.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  // Orders must be removed before customers because customer history is restricted.
  await db.order.deleteMany({ where: { businessId: { in: ids } } });
  await db.business.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
