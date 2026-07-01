import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { getSubscriptionBillingPreview } from "@/lib/subscription-billing";
import { billingCheckoutPreviewSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:billing:read");
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = billingCheckoutPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const preview = await getSubscriptionBillingPreview({
    businessId: auth.session.businessId,
    ...parsed.data
  });
  if (!preview.ok) {
    return NextResponse.json({ error: preview.error }, { status: 400 });
  }

  return NextResponse.json(preview.preview, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
