import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { getBusinessIntelligencePayload } from "@/lib/business-intelligence-data";
import type { BusinessIntelligencePayload } from "@/lib/business-intelligence";
import { LiveDataNotFoundError } from "@/lib/live-data";

export async function intelligenceJson<T>(buildResponse: (payload: BusinessIntelligencePayload) => T) {
  const auth = await requireBusinessSession("business:reports:read");
  if (auth.response) return auth.response;

  try {
    const payload = await getBusinessIntelligencePayload(auth.session.businessId);
    return NextResponse.json(buildResponse(payload));
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Intelligence engine is unavailable right now" }, { status: 503 });
  }
}
