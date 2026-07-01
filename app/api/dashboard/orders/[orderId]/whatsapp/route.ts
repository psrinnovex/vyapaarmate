import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:orders:update");
  if (auth.response) return auth.response;
  const { session } = auth;

  const { orderId } = await context.params;
  const result = await sendOrderWhatsappUpdate({ businessId: session.businessId, orderId });

  if (!result.sent && result.reason === "not_found") {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!result.sent && result.reason === "customer_not_opted_in") {
    return NextResponse.json({ error: "Customer has not opted in for WhatsApp updates." }, { status: 400 });
  }

  if (!result.sent && result.reason === "business_whatsapp_not_live") {
    return NextResponse.json({ error: "WhatsApp is not enabled for this business. Use website status updates instead." }, { status: 400 });
  }

  if (!result.sent) {
    return NextResponse.json({ error: "WhatsApp update could not be sent." }, { status: 502 });
  }

  return NextResponse.json(result);
}
