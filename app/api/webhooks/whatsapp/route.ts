import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleWhatsAppCommerceMessages } from "@/services/whatsapp-commerce";
import {
  extractWhatsAppInboundMessages,
  extractWhatsAppStatusUpdates,
  verifyWhatsAppWebhookSignature,
  verifyWhatsAppWebhookToken
} from "@/services/whatsapp";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (verifyWhatsAppWebhookToken(mode, token) && challenge) {
    return new NextResponse(challenge);
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWhatsAppWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const statusUpdates = extractWhatsAppStatusUpdates(payload);
  const inboundMessages = extractWhatsAppInboundMessages(payload);
  await Promise.all(
    statusUpdates.map((update) =>
      prisma.whatsappMessage.updateMany({
        where: { providerMessageId: update.providerMessageId },
        data: {
          status: update.status,
          sentAt: update.status === "SENT" ? update.timestamp : undefined,
          deliveredAt: update.status === "DELIVERED" ? update.timestamp : undefined,
          failedAt: update.status === "FAILED" ? update.timestamp : undefined,
          errorMessage: update.errorMessage
        }
      })
    )
  );
  const commerceResult = await handleWhatsAppCommerceMessages(inboundMessages);

  const payloadType =
    payload && typeof payload === "object" && !Array.isArray(payload) && "object" in payload
      ? String(payload.object)
      : "unknown";

  return NextResponse.json({
    received: true,
    payloadType,
    statusUpdates: statusUpdates.length,
    inboundMessages: commerceResult.inboundMessages,
    repliesSent: commerceResult.repliesSent,
    ordersCreated: commerceResult.ordersCreated
  });
}
