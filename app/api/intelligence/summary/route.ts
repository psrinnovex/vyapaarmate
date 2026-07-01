import { intelligenceJson } from "@/app/api/intelligence/_shared";
import { buildIntelligenceSummary } from "@/lib/business-intelligence-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return intelligenceJson(buildIntelligenceSummary);
}
