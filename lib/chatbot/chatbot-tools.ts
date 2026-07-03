import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { canAccessBusiness } from "@/lib/security/authz";
import type { ChatbotSecurityContext } from "@/lib/chatbot/chatbot-context";
import { chatbotToolRefusal, isChatbotToolAllowed, type ChatbotToolName } from "@/lib/chatbot/chatbot-policy";
import { redactChatbotText } from "@/lib/chatbot/chatbot-redaction";
import { writeChatbotAuditLog } from "@/lib/chatbot/chatbot-audit";

const publicBusinessSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/)
});

const customerOrderSchema = z.object({
  orderPublicToken: z.string().trim().min(20).max(100).optional(),
  orderNumber: z.string().trim().min(3).max(80).optional()
}).refine((value) => value.orderPublicToken || value.orderNumber, "Provide an order token or order number.");

const businessSummarySchema = z.object({
  businessId: z.string().trim().min(1).optional()
});

export class ChatbotToolAuthorizationError extends Error {
  constructor(message = "Chatbot tool is not authorized.") {
    super(message);
    this.name = "ChatbotToolAuthorizationError";
  }
}

export class ChatbotToolValidationError extends Error {
  constructor(message = "Invalid chatbot tool input.") {
    super(message);
    this.name = "ChatbotToolValidationError";
  }
}

export async function runChatbotTool(toolName: ChatbotToolName, input: unknown, context: ChatbotSecurityContext) {
  assertChatbotToolAllowed(toolName, context);

  switch (toolName) {
    case "getPublicBusinessInfo":
      return getPublicBusinessInfo(input, context);
    case "getCustomerOwnOrderStatus":
      return getCustomerOwnOrderStatus(input, context);
    case "getBusinessOwnerSummary":
      return getBusinessOwnerSummary(input, context);
    case "getAssignedSupportTickets":
      return getAssignedSupportTickets(context);
    default:
      throw new ChatbotToolAuthorizationError(chatbotToolRefusal(toolName));
  }
}

export function assertChatbotToolAllowed(toolName: string, context: ChatbotSecurityContext) {
  if (!isChatbotToolAllowed(context.mode, toolName)) {
    throw new ChatbotToolAuthorizationError(chatbotToolRefusal(toolName));
  }
}

export function assertChatbotBusinessToolAccess(context: ChatbotSecurityContext, requestedBusinessId?: string | null) {
  if (!context.authenticated || !context.role) {
    throw new ChatbotToolAuthorizationError("Authentication is required.");
  }

  const businessId = requestedBusinessId ?? context.businessId;
  if (!businessId) throw new ChatbotToolAuthorizationError("Business scope is required.");
  if (!canAccessBusiness({ role: context.role, businessId: context.businessId }, businessId)) {
    throw new ChatbotToolAuthorizationError("Cross-tenant chatbot access is not allowed.");
  }

  return businessId;
}

export function supportTicketVisibilityWhere(context: ChatbotSecurityContext): Prisma.SupportTicketWhereInput {
  if (context.role === "SUPER_ADMIN") return {};
  if (context.role === "SUPPORT_AGENT" && context.userId) {
    return {
      OR: [
        { assignedToUserId: context.userId },
        { assignedToUserId: null, status: "OPEN" }
      ]
    };
  }

  throw new ChatbotToolAuthorizationError("Support-agent access is required.");
}

async function getPublicBusinessInfo(input: unknown, context: ChatbotSecurityContext) {
  const parsed = publicBusinessSchema.safeParse(input);
  if (!parsed.success) throw new ChatbotToolValidationError();

  const business = await prisma.business.findFirst({
    where: {
      slug: parsed.data.slug,
      isActive: true,
      isVerified: true
    },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      businessType: true,
      businessHours: true,
      isOpen: true,
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true,
      menuItems: {
        where: { isAvailable: true },
        orderBy: [{ isBestSeller: "desc" }, { name: "asc" }],
        take: 12,
        select: { name: true, price: true, foodType: true }
      }
    }
  });

  await writeChatbotAuditLog({
    context,
    action: "CHATBOT_TOOL_CALLED",
    metadata: { toolName: "getPublicBusinessInfo", slug: parsed.data.slug, found: Boolean(business) }
  });

  if (!business) return null;
  return {
    name: business.name,
    slug: business.slug,
    city: business.city,
    state: business.state,
    businessType: business.businessType,
    businessHours: business.businessHours,
    isOpen: business.isOpen,
    fulfillment: {
      pickup: business.acceptsPickup,
      dineIn: business.acceptsDineIn,
      serviceAtLocation: business.acceptsServiceAtLocation
    },
    sampleItems: business.menuItems.map((item) => ({
      name: item.name,
      price: Number(item.price),
      foodType: item.foodType
    }))
  };
}

async function getCustomerOwnOrderStatus(input: unknown, context: ChatbotSecurityContext) {
  if (!context.userId || context.role !== "CUSTOMER") {
    throw new ChatbotToolAuthorizationError("Customer login is required.");
  }

  const parsed = customerOrderSchema.safeParse(input);
  if (!parsed.success) throw new ChatbotToolValidationError();

  const user = await prisma.user.findUnique({
    where: { id: context.userId, role: "CUSTOMER" },
    select: { email: true, phone: true, phoneVerifiedAt: true }
  });
  if (!user) throw new ChatbotToolAuthorizationError("Customer login is required.");

  const contactFilters: Prisma.CustomerWhereInput[] = [
    { email: { equals: user.email, mode: Prisma.QueryMode.insensitive } }
  ];
  if (user.phone && user.phoneVerifiedAt) contactFilters.push({ phone: user.phone });

  const order = await prisma.order.findFirst({
    where: {
      ...(parsed.data.orderPublicToken ? { publicToken: parsed.data.orderPublicToken } : { orderNumber: parsed.data.orderNumber }),
      customer: { is: { OR: contactFilters } }
    },
    select: {
      publicToken: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      business: { select: { name: true, slug: true } },
      payment: { select: { provider: true, status: true, paidAt: true } }
    }
  });

  await writeChatbotAuditLog({
    context,
    action: "CHATBOT_TOOL_CALLED",
    metadata: { toolName: "getCustomerOwnOrderStatus", found: Boolean(order) }
  });

  if (!order) throw new ChatbotToolAuthorizationError("Order was not found for this customer.");

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: Number(order.totalAmount),
    businessName: order.business.name,
    businessSlug: order.business.slug,
    payment: order.payment
      ? {
          provider: order.payment.provider,
          status: order.payment.status,
          paidAt: order.payment.paidAt?.toISOString() ?? null
        }
      : null,
    updatedAt: order.updatedAt.toISOString(),
    orderPath: `/order/${encodeURIComponent(order.publicToken)}`
  };
}

async function getBusinessOwnerSummary(input: unknown, context: ChatbotSecurityContext) {
  const parsed = businessSummarySchema.safeParse(input);
  if (!parsed.success) throw new ChatbotToolValidationError();

  const businessId = assertChatbotBusinessToolAccess(context, parsed.data.businessId);
  if (context.role !== "SUPER_ADMIN" && context.role !== "OWNER" && context.role !== "MANAGER") {
    throw new ChatbotToolAuthorizationError("Business summary is not available for this role.");
  }
  if (context.role === "MANAGER" && !hasPermission(context.role, "business:overview:read")) {
    throw new ChatbotToolAuthorizationError("Business summary is not available for this role.");
  }

  const [business, openOrders, pendingPayments, activeTickets] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, slug: true, subscriptionStatus: true, isActive: true, isVerified: true }
    }),
    prisma.order.count({ where: { businessId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } } }),
    prisma.payment.count({ where: { businessId, status: "PENDING" } }),
    prisma.supportTicket.count({ where: { businessId, status: { in: ["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER"] } } })
  ]);

  await writeChatbotAuditLog({
    context,
    action: "CHATBOT_TOOL_CALLED",
    metadata: { toolName: "getBusinessOwnerSummary", businessId }
  });

  if (!business) return null;
  return {
    businessName: business.name,
    slug: business.slug,
    subscriptionStatus: business.subscriptionStatus,
    active: business.isActive,
    verified: business.isVerified,
    openOrders,
    pendingPayments,
    activeSupportTickets: activeTickets
  };
}

async function getAssignedSupportTickets(context: ChatbotSecurityContext) {
  const tickets = await prisma.supportTicket.findMany({
    where: supportTicketVisibilityWhere(context),
    orderBy: [{ lastMessageAt: "desc" }],
    take: 25,
    select: {
      id: true,
      code: true,
      subject: true,
      priority: true,
      status: true,
      businessId: true,
      assignedToUserId: true,
      lastMessage: true,
      lastMessageAt: true
    }
  });

  await writeChatbotAuditLog({
    context,
    action: "CHATBOT_TOOL_CALLED",
    metadata: { toolName: "getAssignedSupportTickets", count: tickets.length }
  });

  return tickets.map((ticket) => ({
    id: ticket.id,
    code: ticket.code,
    subject: redactChatbotText(ticket.subject),
    priority: ticket.priority,
    status: ticket.status,
    businessId: ticket.businessId,
    assignedToUserId: ticket.assignedToUserId,
    lastMessage: redactChatbotText(ticket.lastMessage),
    lastMessageAt: ticket.lastMessageAt.toISOString()
  }));
}
