import type { Business, Customer, Prisma } from "@prisma/client";
import { fulfillmentFeeForOrder, fulfillmentModesFromFlags, isFoodBusinessType, type ActiveFulfillmentMode } from "@/lib/business-rules";
import { buildOrderCouponBreakdown } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils";
import { businessWhatsappConfig } from "@/services/business-whatsapp";
import { terminateCashfreeOrder } from "@/services/cashfree";
import { canBusinessAcceptOnlinePayment, createCustomerPaymentRequest, getOnlinePaymentConfig, selectedOnlinePaymentProvider, type CustomerPaymentRequestResult } from "@/services/online-payments";
import { createUpiQrImageDataUrl } from "@/services/upi";
import {
  sendWhatsAppImage,
  sendWhatsAppInteractiveList,
  sendWhatsAppText,
  type WhatsAppInboundMessage,
  type WhatsAppListSection,
  type WhatsAppOutboundResult
} from "@/services/whatsapp";

const CART_MARKER = "[WA_CART]";
const BOOKING_MARKER = "[WA_BOOKING]";
const NATIVE_ORDER_MARKER = "[WA_NATIVE_ORDER]";

type MenuItemWithCategory = Prisma.MenuItemGetPayload<{ include: { category: true } }>;
type OrderWithItems = Prisma.OrderGetPayload<{ include: { customer: true; items: true; payment: true } }>;
type LegacyUpiPaymentQrResult = {
  provider: "UPI";
  status: string;
  paymentRequestId: string;
  paymentRequestUrl: string | null;
  paymentQrImageUrl: string | null;
  expiresAt: string;
  message: string;
};
type PaymentQrResult = CustomerPaymentRequestResult | LegacyUpiPaymentQrResult;

export type WhatsAppCommerceResult = {
  inboundMessages: number;
  repliesSent: number;
  ordersCreated: number;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : value;
}

function parseBusinessPhoneMap() {
  const raw = process.env.WHATSAPP_BUSINESS_PHONE_MAP;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : []))
    );
  } catch {
    return {};
  }
}

function mapLookupKeys(message: WhatsAppInboundMessage) {
  return Array.from(new Set([
    message.phoneNumberId,
    message.displayPhoneNumber,
    message.displayPhoneNumber ? normalizePhone(message.displayPhoneNumber) : undefined,
    message.displayPhoneNumber?.replace(/\D/g, "")
  ].filter((value): value is string => Boolean(value))));
}

async function findConfiguredBusiness(configuredBusiness: string | undefined) {
  if (!configuredBusiness) return null;

  return prisma.business.findFirst({
    where: {
      isActive: true,
      isVerified: true,
      OR: [{ id: configuredBusiness }, { slug: configuredBusiness }]
    }
  });
}

async function resolveBusiness(message: WhatsAppInboundMessage) {
  if (message.phoneNumberId) {
    const business = await prisma.business.findFirst({
      where: {
        isActive: true,
        isVerified: true,
        whatsappConnected: true,
        whatsappPhoneNumberId: message.phoneNumberId
      },
      orderBy: { updatedAt: "desc" }
    });
    if (business) return business;
  }

  if (message.displayPhoneNumber) {
    const displayPhone = normalizePhone(message.displayPhoneNumber);
    const business = await prisma.business.findFirst({
      where: {
        isActive: true,
        isVerified: true,
        whatsappConnected: true,
        OR: [{ whatsappDisplayPhone: displayPhone }, { phone: displayPhone }]
      },
      orderBy: { updatedAt: "desc" }
    });
    if (business) return business;
  }

  const phoneMap = parseBusinessPhoneMap();
  const mappedBusiness = mapLookupKeys(message).map((key) => phoneMap[key]).find(Boolean);

  if (mappedBusiness) {
    const business = await findConfiguredBusiness(mappedBusiness);
    if (business) return business;
  }

  if (message.displayPhoneNumber) {
    const displayPhone = normalizePhone(message.displayPhoneNumber);
    const business = await prisma.business.findFirst({
      where: { isActive: true, isVerified: true, phone: displayPhone },
      orderBy: { updatedAt: "desc" }
    });
    if (business) return business;
  }

  const defaultBusiness = await findConfiguredBusiness(process.env.WHATSAPP_DEFAULT_BUSINESS_SLUG);
  if (defaultBusiness) return defaultBusiness;

  return null;
}

async function upsertWhatsAppCustomer(business: Business, message: WhatsAppInboundMessage) {
  const phone = normalizePhone(message.from);
  const name = message.profileName?.trim() || `WhatsApp ${phone.slice(-4)}`;

  return prisma.customer.upsert({
    where: {
      businessId_phone: {
        businessId: business.id,
        phone
      }
    },
    create: {
      businessId: business.id,
      name,
      phone,
      whatsappOptIn: true,
      marketingOptIn: false
    },
    update: {
      name,
      whatsappOptIn: true
    }
  });
}

function isAppointmentBusiness(business: Business) {
  const normalized = business.businessType.toLowerCase();
  if (/(grocery|pharmacy|retail|store|product)/.test(normalized)) return false;
  return /(salon|spa|service|repair|laundry|tailor|fitness|yoga|class|appointment|home)/.test(normalized) || !isFoodBusinessType(business.businessType);
}

function fulfillmentModesForBusiness(business: Business) {
  return fulfillmentModesFromFlags({
    businessType: business.businessType,
    acceptsPickup: business.acceptsPickup,
    acceptsDineIn: business.acceptsDineIn,
    acceptsServiceAtLocation: business.acceptsServiceAtLocation
  });
}

function preferredOrderType(business: Business): ActiveFulfillmentMode {
  const modes = fulfillmentModesForBusiness(business);

  if (isAppointmentBusiness(business)) {
    return modes.includes("SERVICE_AT_LOCATION") ? "SERVICE_AT_LOCATION" : modes.includes("DINE_IN") ? "DINE_IN" : "PICKUP";
  }

  return modes[0] ?? "PICKUP";
}

function orderFeeForBusiness(business: Business, orderType: ActiveFulfillmentMode, hasItems: boolean) {
  return fulfillmentFeeForOrder({
    fee: Number(business.deliveryFee),
    orderType,
    fulfillmentModes: fulfillmentModesForBusiness(business),
    hasItems
  });
}

function isCatalogIntent(text: string) {
  return /\b(hi|hello|start|menu|catalog|service|services|items|order|book|booking|appointment)\b/i.test(text);
}

function isPaymentIntent(text: string) {
  return /\b(pay|payment|upi|qr|checkout)\b/i.test(text);
}

function isClearCartIntent(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^please /, "")
    .replace(/ please$/, "");
  return (
    /^(clear|empty|reset|remove|delete)( my)?( cart| basket| items| selection| order)?$/.test(normalized) ||
    /^cancel( my)? (cart|basket|selection)$/.test(normalized)
  );
}

function orderNumber() {
  return `VM-${Date.now().toString().slice(-6)}`;
}

function rowDescription(item: MenuItemWithCategory) {
  const details = [formatINR(Number(item.price)), item.description].filter(Boolean).join(" - ");
  return details;
}

async function catalogSections(business: Business): Promise<WhatsAppListSection[]> {
  const items = await prisma.menuItem.findMany({
    where: { businessId: business.id, isAvailable: true },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { isBestSeller: "desc" }, { name: "asc" }],
    take: 90
  });

  const grouped = new Map<string, MenuItemWithCategory[]>();
  for (const item of items) {
    const group = grouped.get(item.category.name) ?? [];
    group.push(item);
    grouped.set(item.category.name, group);
  }

  return Array.from(grouped.entries()).map(([title, group]) => ({
    title,
    rows: group.slice(0, 10).map((item) => ({
      id: `wa:item:${item.id}`,
      title: item.name,
      description: rowDescription(item)
    }))
  }));
}

async function logOutbound(input: {
  business: Business;
  customer: Customer;
  orderId?: string;
  templateName: string;
  phone: string;
  result?: WhatsAppOutboundResult;
  error?: unknown;
}) {
  await prisma.whatsappMessage.create({
    data: {
      businessId: input.business.id,
      customerId: input.customer.id,
      orderId: input.orderId,
      templateName: input.templateName,
      phone: input.phone,
      providerMessageId: input.result?.messageId,
      status: input.error ? "FAILED" : input.result?.status === "placeholder" ? "QUEUED" : "SENT",
      sentAt: input.error || input.result?.status === "placeholder" ? null : new Date(),
      failedAt: input.error ? new Date() : null,
      errorMessage: input.error instanceof Error ? input.error.message : input.error ? "WhatsApp message failed." : null
    }
  });
}

async function sendTextAndLog(input: {
  business: Business;
  customer: Customer;
  orderId?: string;
  templateName: string;
  body: string;
}) {
  try {
    const result = await sendWhatsAppText(input.customer.phone, input.body, businessWhatsappConfig(input.business));
    await logOutbound({ ...input, phone: input.customer.phone, result });
    return true;
  } catch (error) {
    await logOutbound({ ...input, phone: input.customer.phone, error });
    return false;
  }
}

async function sendListAndLog(input: {
  business: Business;
  customer: Customer;
  templateName: string;
  header: string;
  body: string;
  footer?: string;
  buttonText: string;
  sections: WhatsAppListSection[];
}) {
  try {
    const result = await sendWhatsAppInteractiveList({
      phone: input.customer.phone,
      header: input.header,
      body: input.body,
      footer: input.footer,
      buttonText: input.buttonText,
      sections: input.sections,
      config: businessWhatsappConfig(input.business)
    });
    await logOutbound({ ...input, phone: input.customer.phone, result });
    return true;
  } catch (error) {
    await logOutbound({ ...input, phone: input.customer.phone, error });
    return false;
  }
}

async function sendImageAndLog(input: {
  business: Business;
  customer: Customer;
  orderId?: string;
  templateName: string;
  imageUrl: string;
  caption?: string;
}) {
  try {
    const result = await sendWhatsAppImage({
      phone: input.customer.phone,
      imageUrl: input.imageUrl,
      caption: input.caption,
      config: businessWhatsappConfig(input.business)
    });
    await logOutbound({ ...input, phone: input.customer.phone, result });
    return true;
  } catch (error) {
    await logOutbound({ ...input, phone: input.customer.phone, error });
    return false;
  }
}

async function sendCatalogMenu(business: Business, customer: Customer) {
  const sections = await catalogSections(business);

  if (sections.length === 0) {
    return sendTextAndLog({
      business,
      customer,
      templateName: "whatsapp_catalog_empty",
      body: `${business.name} has not published any available items or services yet. You can reply here and the team will help you.`
    });
  }

  return sendListAndLog({
    business,
    customer,
    templateName: "whatsapp_catalog_menu",
    header: business.name,
    body: isAppointmentBusiness(business)
      ? "Choose a service. After selecting it, reply with your preferred date, time, and any notes. Reply clear to reset your selection."
      : "Choose an item from the catalog. Reply menu to add more, pay when ready, or clear to empty the cart.",
    footer: "Reply menu, pay, clear, or help anytime.",
    buttonText: isAppointmentBusiness(business) ? "View services" : "View catalog",
    sections
  });
}

function orderSummary(order: OrderWithItems) {
  const lines = order.items.map((item) => `- ${item.quantity} x ${item.itemName}: ${formatINR(Number(item.total))}`);
  return [
    `${order.orderNumber} is saved.`,
    ...lines,
    `Total: ${formatINR(Number(order.totalAmount))}`
  ].join("\n");
}

function paymentQrInstruction(paymentQr: PaymentQrResult | null) {
  if (!paymentQr) return "Payment QR could not be generated right now. The team can still help with this order from the dashboard.";
  if (paymentQr.provider === "CASHFREE") {
    return `Your Cashfree checkout is ready: ${paymentQr.paymentRequestUrl}\nIt expires at ${new Date(paymentQr.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. Payment success updates automatically after Cashfree confirms it.`;
  }
  if (paymentQr.provider === "UPI" && paymentQr.paymentRequestUrl) {
    return `Open this PSHR Innovex UPI request to pay: ${paymentQr.paymentRequestUrl}\nIt expires at ${new Date(paymentQr.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. PSHR admin verifies the bank transaction before the business wallet is credited.`;
  }
  return "Your online payment request is ready. Payment success updates automatically after the gateway confirms it.";
}

function paymentQrCaption(order: OrderWithItems, business: Business, paymentQr: PaymentQrResult) {
  return [
    `${business.name} payment`,
    `Order: ${order.orderNumber}`,
    `Amount: ${formatINR(Number(order.totalAmount))}`,
    `Expires: ${new Date(paymentQr.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
  ].join("\n");
}

async function existingPaymentQr(order: OrderWithItems): Promise<PaymentQrResult | null> {
  if (order.status === "CANCELLED") return null;
  const payment = order.payment;
  if (!payment?.paymentRequestUrl || !payment.paymentRequestExpiresAt) return null;
  if (payment.paymentRequestExpiresAt.getTime() <= Date.now() + 60_000) return null;

  const sharedResult = {
    provider: payment.provider === "CASHFREE" ? "CASHFREE" : "UPI",
    status: "created",
    paymentRequestId: payment.cashfreeOrderId ?? `upi_${order.orderNumber}`,
    expiresAt: payment.paymentRequestExpiresAt.toISOString(),
    message:
      payment.provider === "CASHFREE"
        ? "Existing Cashfree checkout is still active."
        : "Existing UPI payment request is still active."
  };

  if (payment.provider === "CASHFREE") {
    return {
      ...sharedResult,
      provider: "CASHFREE",
      paymentRequestUrl: payment.paymentRequestUrl,
      paymentQrImageUrl: null,
      cashfreeOrderId: payment.cashfreeOrderId ?? undefined,
      cashfreeCfOrderId: payment.cashfreeCfOrderId,
      cashfreePaymentSessionId: payment.cashfreePaymentSessionId ?? undefined
    };
  }

  return {
    ...sharedResult,
    provider: "UPI",
    paymentRequestUrl: payment.paymentRequestUrl,
    paymentQrImageUrl: payment.paymentRequestUrl.startsWith("upi://")
      ? await createUpiQrImageDataUrl(payment.paymentRequestUrl).catch(() => null)
      : null
  };
}

async function attachPaymentQr(order: OrderWithItems, business: Business) {
  if (order.status === "CANCELLED") return null;
  const existing = await existingPaymentQr(order);
  if (existing) return existing;
  const paymentConfig = await getOnlinePaymentConfig();
  if (!canBusinessAcceptOnlinePayment(business, paymentConfig)) return null;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const paymentQr = await createCustomerPaymentRequest({
    appUrl,
    amount: Number(order.totalAmount),
    orderNumber: order.orderNumber,
    orderId: order.id,
    publicToken: order.publicToken,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    business,
    description: `${business.name} ${order.orderNumber}`,
    notes: {
      kind: "whatsapp_customer_order",
      businessId: business.id,
      orderId: order.id,
      publicToken: order.publicToken,
      orderNumber: order.orderNumber
    }
  }, paymentConfig).catch(() => null);

  if (paymentQr?.paymentRequestId) {
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        provider: paymentQr.provider,
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        cashfreeOrderId: paymentQr.provider === "CASHFREE" ? paymentQr.cashfreeOrderId ?? paymentQr.paymentRequestId : null,
        cashfreeCfOrderId: paymentQr.provider === "CASHFREE" ? paymentQr.cashfreeCfOrderId ?? null : null,
        cashfreePaymentSessionId: paymentQr.provider === "CASHFREE" ? paymentQr.cashfreePaymentSessionId ?? null : null,
        cashfreePaymentId: null,
        cashfreeOrderStatus: paymentQr.provider === "CASHFREE" ? paymentQr.status : null,
        paymentRequestUrl: paymentQr.paymentRequestUrl,
        paymentRequestExpiresAt: new Date(paymentQr.expiresAt),
        amount: Number(order.totalAmount)
      }
    });
  }

  return paymentQr;
}

async function sendPaymentRequest(input: {
  business: Business;
  customer: Customer;
  order: OrderWithItems;
  templateName: string;
  closingLine: string;
}) {
  const paymentQr = await attachPaymentQr(input.order, input.business);
  await sendTextAndLog({
    business: input.business,
    customer: input.customer,
    orderId: input.order.id,
    templateName: input.templateName,
    body: `${orderSummary(input.order)}\n\n${paymentQrInstruction(paymentQr)}\n${input.closingLine}`
  });

  if (paymentQr?.paymentQrImageUrl && /^https?:\/\//i.test(paymentQr.paymentQrImageUrl)) {
    await sendImageAndLog({
      business: input.business,
      customer: input.customer,
      orderId: input.order.id,
      templateName: `${input.templateName}_qr_image`,
      imageUrl: paymentQr.paymentQrImageUrl,
      caption: paymentQrCaption(input.order, input.business, paymentQr)
    });
  }

  return paymentQr;
}

async function latestWhatsAppOrder(customer: Customer, marker = CART_MARKER) {
  return prisma.order.findFirst({
    where: {
      customerId: customer.id,
      status: "NEW",
      paymentStatus: "PENDING",
      notes: { contains: marker }
    },
    orderBy: { createdAt: "desc" },
    include: { customer: true, items: true, payment: true }
  });
}

async function latestPendingWhatsAppSelection(customer: Customer) {
  return prisma.order.findFirst({
    where: {
      customerId: customer.id,
      status: "NEW",
      paymentStatus: "PENDING",
      OR: [
        { notes: { contains: CART_MARKER } },
        { notes: { contains: BOOKING_MARKER } },
        { notes: { contains: NATIVE_ORDER_MARKER } }
      ]
    },
    orderBy: { createdAt: "desc" },
    include: { customer: true, items: true, payment: true }
  });
}

async function clearPendingWhatsAppOrder(order: OrderWithItems) {
  const clearedAt = new Date();
  let cashfreeOrderStatus = order.payment?.cashfreeOrderStatus ?? null;
  let cashfreePaymentSessionId = order.payment?.cashfreePaymentSessionId ?? null;

  if (
    order.payment?.provider === "CASHFREE" &&
    order.payment.cashfreeOrderId &&
    ["PENDING", "FAILED"].includes(order.payment.status)
  ) {
    try {
      const termination = await terminateCashfreeOrder(order.payment.cashfreeOrderId);
      cashfreeOrderStatus = termination.orderStatus ?? "TERMINATED";
      cashfreePaymentSessionId = termination.paymentSessionId;
    } catch {
      cashfreeOrderStatus = cashfreeOrderStatus ?? "CUSTOMER_CART_CLEARED";
    }
  }

  return prisma.$transaction(async (tx) => {
    const paymentData: Prisma.PaymentUpdateManyMutationInput = {
      status: "FAILED",
      paidAt: null,
      paymentRequestUrl: null,
      paymentRequestExpiresAt: clearedAt,
      paymentReminderSentAt: null
    };

    if (order.payment?.provider === "CASHFREE") {
      paymentData.cashfreeOrderStatus = cashfreeOrderStatus;
      paymentData.cashfreePaymentSessionId = cashfreePaymentSessionId;
    }

    await tx.payment.updateMany({
      where: { orderId: order.id, status: { in: ["PENDING", "FAILED"] } },
      data: paymentData
    });

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: "NEW", paymentStatus: "PENDING" },
      data: {
        status: "CANCELLED",
        paymentStatus: "FAILED",
        notes: [order.notes, "Customer cleared this pending WhatsApp cart."].filter(Boolean).join("\n")
      }
    });

    return updated.count > 0;
  });
}

async function addItemToWhatsAppOrder(input: {
  business: Business;
  customer: Customer;
  item: MenuItemWithCategory;
  quantity: number;
  marker: typeof CART_MARKER | typeof BOOKING_MARKER;
}) {
  const orderType = preferredOrderType(input.business);
  const price = Number(input.item.price);
  const requestedQuantity = Math.max(1, Math.min(99, input.quantity));
  const existing = await latestWhatsAppOrder(input.customer, input.marker);
  const paymentConfig = await getOnlinePaymentConfig();

  const order = await prisma.$transaction(async (tx) => {
    if (!existing) {
      const subtotal = price * requestedQuantity;
      const deliveryFee = orderFeeForBusiness(input.business, orderType, true);
      const billing = buildOrderCouponBreakdown({ subtotal, serviceFee: deliveryFee });
      const totalAmount = billing.total;
      const created = await tx.order.create({
        data: {
          businessId: input.business.id,
          customerId: input.customer.id,
          orderNumber: orderNumber(),
          subtotal,
          deliveryFee: billing.serviceFee,
          taxableAmount: billing.taxableAmount,
          gstRateBps: billing.gstRateBps,
          gstAmount: billing.gstAmount,
          totalAmount,
          orderType,
          notes:
            input.marker === BOOKING_MARKER
              ? `${BOOKING_MARKER} Awaiting preferred appointment date/time from WhatsApp.`
              : `${CART_MARKER} Customer is building this cart in WhatsApp.`,
          status: "NEW",
          paymentStatus: "PENDING",
          items: {
            create: {
              menuItemId: input.item.id,
              itemName: input.item.name,
              quantity: requestedQuantity,
              price,
              total: subtotal
            }
          }
        },
        include: { customer: true, items: true, payment: true }
      });

      await tx.payment.create({
        data: {
          businessId: input.business.id,
          orderId: created.id,
          provider: canBusinessAcceptOnlinePayment(input.business, paymentConfig) ? selectedOnlinePaymentProvider(paymentConfig) : "CASH",
          amount: totalAmount,
          status: "PENDING"
        }
      });
      await tx.customer.update({
        where: { id: input.customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalAmount },
          lastOrderAt: new Date()
        }
      });

      return created;
    }

    const existingLine = existing.items.find((line) => line.menuItemId === input.item.id);
    if (existingLine) {
      const nextQuantity = Math.min(99, existingLine.quantity + requestedQuantity);
      await tx.orderItem.update({
        where: { id: existingLine.id },
        data: {
          quantity: nextQuantity,
          total: nextQuantity * price
        }
      });
    } else {
      await tx.orderItem.create({
        data: {
          orderId: existing.id,
          menuItemId: input.item.id,
          itemName: input.item.name,
          quantity: requestedQuantity,
          price,
          total: price * requestedQuantity
        }
      });
    }

    const updatedItems = await tx.orderItem.findMany({ where: { orderId: existing.id } });
    const subtotal = updatedItems.reduce((sum, line) => sum + Number(line.total), 0);
    const deliveryFee = orderFeeForBusiness(input.business, orderType, updatedItems.length > 0);
    const billing = buildOrderCouponBreakdown({ subtotal, serviceFee: deliveryFee });
    const totalAmount = billing.total;
    const difference = totalAmount - Number(existing.totalAmount);

    const updated = await tx.order.update({
      where: { id: existing.id },
      data: {
        subtotal,
        deliveryFee: billing.serviceFee,
        taxableAmount: billing.taxableAmount,
        gstRateBps: billing.gstRateBps,
        gstAmount: billing.gstAmount,
        totalAmount
      },
      include: { customer: true, items: true, payment: true }
    });
    await tx.payment.update({
      where: { orderId: existing.id },
      data: {
        amount: totalAmount,
        status: "PENDING",
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        cashfreeOrderId: null,
        cashfreeCfOrderId: null,
        cashfreePaymentSessionId: null,
        cashfreePaymentId: null,
        cashfreeOrderStatus: null,
        paymentRequestUrl: null,
        paymentRequestExpiresAt: null
      }
    });
    if (difference !== 0) {
      await tx.customer.update({
        where: { id: input.customer.id },
        data: { totalSpent: { increment: difference }, lastOrderAt: new Date() }
      });
    }

    return updated;
  });

  return prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { customer: true, items: true, payment: true }
  });
}

async function handleItemSelection(business: Business, customer: Customer, itemId: string) {
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, businessId: business.id, isAvailable: true },
    include: { category: true }
  });

  if (!item) {
    await sendTextAndLog({
      business,
      customer,
      templateName: "whatsapp_item_unavailable",
      body: "That item or service is not available right now. Reply menu to choose another option."
    });
    return { repliesSent: 1, ordersCreated: 0 };
  }

  const appointment = isAppointmentBusiness(business);
  const order = await addItemToWhatsAppOrder({
    business,
    customer,
    item,
    quantity: 1,
    marker: appointment ? BOOKING_MARKER : CART_MARKER
  });

  await sendTextAndLog({
    business,
    customer,
    orderId: order.id,
    templateName: appointment ? "whatsapp_booking_started" : "whatsapp_cart_updated",
    body: appointment
      ? `${item.name} is selected for ${order.orderNumber}.\n\nReply with your preferred date/time, location if needed, and any notes. Reply clear to reset this selection.`
      : `${orderSummary(order)}\n\nReply menu to add more items, pay when you are ready, or clear to empty this cart.`
  });

  return { repliesSent: 1, ordersCreated: 1 };
}

async function handleClearCartRequest(business: Business, customer: Customer) {
  const order = await latestPendingWhatsAppSelection(customer);
  if (!order) {
    await sendTextAndLog({
      business,
      customer,
      templateName: "whatsapp_no_pending_clear_cart",
      body: `There is no pending WhatsApp cart to clear. Reply menu to choose ${isAppointmentBusiness(business) ? "a service" : "items"}.`
    });
    return true;
  }

  const cleared = await clearPendingWhatsAppOrder(order);
  if (!cleared) {
    await sendTextAndLog({
      business,
      customer,
      orderId: order.id,
      templateName: "whatsapp_cart_clear_skipped",
      body: "This WhatsApp cart was already updated. Reply menu to start again."
    });
    return true;
  }

  const clearedSelection = order.notes?.includes(BOOKING_MARKER) ? "selection" : "cart";
  await sendTextAndLog({
    business,
    customer,
    orderId: order.id,
    templateName: "whatsapp_cart_cleared",
    body: `${order.orderNumber} ${clearedSelection} cleared. Reply menu to start again.`
  });
  return true;
}

async function handlePaymentRequest(business: Business, customer: Customer) {
  const order = await latestWhatsAppOrder(customer, CART_MARKER);
  if (!order) {
    await sendTextAndLog({
      business,
      customer,
      templateName: "whatsapp_no_pending_payment",
      body: "I could not find a pending WhatsApp cart. Reply menu to choose items or services first, or clear to reset."
    });
    return true;
  }

  await sendPaymentRequest({
    business,
    customer,
    order,
    templateName: "whatsapp_payment_qr",
    closingLine: `After payment, ${business.name} will confirm and update you here.`
  });
  return true;
}

async function handleAppointmentReply(business: Business, customer: Customer, text: string) {
  const order = await latestWhatsAppOrder(customer, BOOKING_MARKER);
  if (!order) return false;

  const nextNotes = [order.notes, `Customer reply on WhatsApp: ${text.trim()}`].filter(Boolean).join("\n");
  await prisma.order.update({
    where: { id: order.id },
    data: { notes: nextNotes }
  });
  await sendTextAndLog({
    business,
    customer,
    orderId: order.id,
    templateName: "whatsapp_booking_details_received",
    body: `Got it. ${business.name} has your appointment request ${order.orderNumber} and will confirm the slot here on WhatsApp.`
  });
  return true;
}

function retailerIdCandidates(productRetailerId: string) {
  return Array.from(new Set([
    productRetailerId,
    productRetailerId.replace(/^wa:/, ""),
    productRetailerId.replace(/^item:/, ""),
    productRetailerId.replace(/^wa:item:/, "")
  ]));
}

async function handleNativeCatalogOrder(business: Business, customer: Customer, message: WhatsAppInboundMessage) {
  const requested = message.orderItems.filter((item) => item.quantity > 0);
  if (requested.length === 0) {
    await sendCatalogMenu(business, customer);
    return { repliesSent: 1, ordersCreated: 0 };
  }

  const candidateIds = requested.flatMap((item) => retailerIdCandidates(item.productRetailerId));
  const menuItems = await prisma.menuItem.findMany({
    where: { businessId: business.id, id: { in: candidateIds }, isAvailable: true },
    include: { category: true }
  });

  const lines = requested.flatMap((requestedItem) => {
    const candidates = retailerIdCandidates(requestedItem.productRetailerId);
    const item = menuItems.find((candidate) => candidates.includes(candidate.id));
    return item ? [{ item, quantity: requestedItem.quantity }] : [];
  });

  if (lines.length === 0) {
    await sendTextAndLog({
      business,
      customer,
      templateName: "whatsapp_catalog_order_unmatched",
      body: "I received your WhatsApp catalog order, but could not match the items to this business catalog. Please reply menu and choose from the latest catalog."
    });
    return { repliesSent: 1, ordersCreated: 0 };
  }

  let savedOrder: OrderWithItems | null = null;
  for (const line of lines) {
    savedOrder = await addItemToWhatsAppOrder({
      business,
      customer,
      item: line.item,
      quantity: line.quantity,
      marker: CART_MARKER
    });
  }

  if (!savedOrder) return { repliesSent: 0, ordersCreated: 0 };

  await prisma.order.update({
    where: { id: savedOrder.id },
    data: {
      notes: `${NATIVE_ORDER_MARKER} Received from native WhatsApp catalog cart.`
    }
  });

  const refreshedOrder = await prisma.order.findUniqueOrThrow({
    where: { id: savedOrder.id },
    include: { customer: true, items: true, payment: true }
  });
  await sendPaymentRequest({
    business,
    customer,
    order: refreshedOrder,
    templateName: "whatsapp_catalog_order_received",
    closingLine: `Your catalog order is with ${business.name}. The team will update you here.`
  });

  return { repliesSent: 1, ordersCreated: 1 };
}

async function handleInboundMessage(message: WhatsAppInboundMessage) {
  const business = await resolveBusiness(message);
  if (!business) return { repliesSent: 0, ordersCreated: 0 };

  const customer = await upsertWhatsAppCustomer(business, message);

  if (message.type === "order") {
    return handleNativeCatalogOrder(business, customer, message);
  }

  if (message.type === "interactive" && message.interactiveReplyId?.startsWith("wa:item:")) {
    return handleItemSelection(business, customer, message.interactiveReplyId.slice("wa:item:".length));
  }

  const text = message.text?.trim() ?? "";

  if (text && isClearCartIntent(text)) {
    await handleClearCartRequest(business, customer);
    return { repliesSent: 1, ordersCreated: 0 };
  }

  if (text && isAppointmentBusiness(business) && !isCatalogIntent(text) && !isPaymentIntent(text)) {
    const handled = await handleAppointmentReply(business, customer, text);
    if (handled) return { repliesSent: 1, ordersCreated: 0 };
  }

  if (text && isPaymentIntent(text)) {
    await handlePaymentRequest(business, customer);
    return { repliesSent: 1, ordersCreated: 0 };
  }

  if (!text || isCatalogIntent(text)) {
    await sendCatalogMenu(business, customer);
    return { repliesSent: 1, ordersCreated: 0 };
  }

  await sendTextAndLog({
    business,
    customer,
    templateName: "whatsapp_conversation_fallback",
    body: `Thanks for messaging ${business.name}. Reply menu to choose ${isAppointmentBusiness(business) ? "a service" : "items"}, pay to get your pending payment QR, or clear to empty the cart.`
  });

  return { repliesSent: 1, ordersCreated: 0 };
}

export async function handleWhatsAppCommerceMessages(messages: WhatsAppInboundMessage[]): Promise<WhatsAppCommerceResult> {
  let repliesSent = 0;
  let ordersCreated = 0;

  for (const message of messages) {
    const result = await handleInboundMessage(message);
    repliesSent += result.repliesSent;
    ordersCreated += result.ordersCreated;
  }

  return {
    inboundMessages: messages.length,
    repliesSent,
    ordersCreated
  };
}
