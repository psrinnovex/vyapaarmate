import { intelligenceJson } from "@/app/api/intelligence/_shared";
import { buildRevenueOpportunities } from "@/lib/business-intelligence-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return intelligenceJson(buildRevenueOpportunities);
}
