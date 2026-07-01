import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { getBusinessIntelligenceGovernanceReport } from "@/lib/business-intelligence-governance";
import { LiveDataNotFoundError } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireBusinessSession("business:reports:read");
  if (auth.response) return auth.response;

  try {
    const report = await getBusinessIntelligenceGovernanceReport(auth.session.businessId);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Intelligence data-source report is unavailable right now" }, { status: 503 });
  }
}
