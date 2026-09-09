import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/api-session";
import { getPilotReport } from "@/lib/pilot-data";
import { pilotCohortForLocation } from "@/lib/launch-policy";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/security/validation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const enrollmentSchema = z.object({ businessId: z.string().min(1).max(120), cohort: z.enum(["BENGALURU", "ANDHRA_PRADESH"]).nullable(), consentConfirmed: z.boolean() });

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  return NextResponse.json(await getPilotReport(), { headers });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  const parsed = await parseJsonRequest(request, enrollmentSchema);
  if (parsed.response) return parsed.response;
  const { businessId, cohort, consentConfirmed } = parsed.data;
  if (cohort && !consentConfirmed) return NextResponse.json({ error: "Confirm merchant consent before enrolling a business." }, { status: 400, headers });
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { city: true, state: true, pilotCohort: true, pilotEnrolledAt: true } });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404, headers });
  if (cohort && pilotCohortForLocation(business) !== cohort) return NextResponse.json({ error: "The cohort must match the business operating city and state." }, { status: 400, headers });
  await prisma.$transaction(async tx => {
    await tx.business.update({ where: { id: businessId }, data: { pilotCohort: cohort,
      pilotEnrolledAt: cohort ? (business.pilotCohort === cohort ? business.pilotEnrolledAt ?? new Date() : new Date()) : null } });
    await tx.auditLog.create({ data: { userId: session.id, businessId, action: "PILOT_ENROLLMENT_UPDATED", entity: "Business", entityId: businessId,
      metadata: { previousCohort: business.pilotCohort, cohort, consentConfirmed, confirmedAt: new Date().toISOString() } } });
  });
  return NextResponse.json(await getPilotReport(), { headers });
}
