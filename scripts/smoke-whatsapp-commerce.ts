import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { WhatsAppInboundMessage } from "@/services/whatsapp";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  let raw = "";
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

if (process.env.WHATSAPP_SMOKE_LIVE_SENDS_ENABLED !== "true") {
  process.env.WHATSAPP_LIVE_SENDS_ENABLED = "false";
}

function inboundMessage(input: Partial<WhatsAppInboundMessage> & Pick<WhatsAppInboundMessage, "type">): WhatsAppInboundMessage {
  return {
    providerMessageId: input.providerMessageId ?? `wamid.smoke.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
    from: input.from ?? "919700009999",
    profileName: input.profileName ?? "Smoke Customer",
    type: input.type,
    text: input.text,
    interactiveReplyId: input.interactiveReplyId,
    interactiveReplyTitle: input.interactiveReplyTitle,
    orderItems: input.orderItems ?? [],
    phoneNumberId: input.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? "smoke_phone_number_id",
    displayPhoneNumber: input.displayPhoneNumber ?? "+919999999999",
    timestamp: new Date()
  };
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { handleWhatsAppCommerceMessages } = await import("@/services/whatsapp-commerce");

  try {
    const businessSlug = process.argv[2] ?? process.env.WHATSAPP_DEFAULT_BUSINESS_SLUG ?? "sri-sai-tiffins";
    const business = await prisma.business.findFirst({
      where: {
        isActive: true,
        OR: [{ slug: businessSlug }, { id: businessSlug }]
      },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ isBestSeller: "desc" }, { name: "asc" }],
          take: 1
        }
      }
    });

    if (!business) {
      throw new Error(`No active business found for ${businessSlug}. Seed data or set WHATSAPP_DEFAULT_BUSINESS_SLUG first.`);
    }
    const firstItem = business.menuItems[0];
    if (!firstItem) {
      throw new Error(`${business.name} has no available catalog items/services to smoke test.`);
    }

    const phone = `9197${String(Date.now()).slice(-8)}`;
    const menuResult = await handleWhatsAppCommerceMessages([
      inboundMessage({
        type: "text",
        from: phone,
        text: "hi",
        displayPhoneNumber: business.phone
      })
    ]);
    const selectResult = await handleWhatsAppCommerceMessages([
      inboundMessage({
        type: "interactive",
        from: phone,
        interactiveReplyId: `wa:item:${firstItem.id}`,
        interactiveReplyTitle: firstItem.name,
        displayPhoneNumber: business.phone
      })
    ]);

    const customer = await prisma.customer.findUnique({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: `+${phone}`
        }
      }
    });
    const latestOrder = customer
      ? await prisma.order.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: "desc" },
          include: { items: true, payment: true }
        })
      : null;

    if (!customer || !latestOrder) {
      throw new Error("Smoke test did not create the expected WhatsApp customer/order.");
    }

    const payResult = await handleWhatsAppCommerceMessages([
      inboundMessage({
        type: "text",
        from: phone,
        text: "pay",
        displayPhoneNumber: business.phone
      })
    ]);

    console.log(JSON.stringify({
      business: business.slug,
      selectedItem: firstItem.name,
      customer: customer.phone,
      orderNumber: latestOrder.orderNumber,
      orderItems: latestOrder.items.map((item) => `${item.itemName} x${item.quantity}`),
      paymentProvider: latestOrder.payment?.provider ?? null,
      menuResult,
      selectResult,
      payResult
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
