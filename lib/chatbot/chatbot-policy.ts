import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/session";
import type { SupportChatbotIntent } from "@/lib/support-chatbot";

export type ChatbotMode =
  | "PUBLIC_INFO"
  | "CUSTOMER_AUTH"
  | "BUSINESS_OWNER"
  | "SUPPORT_AGENT"
  | "SUPER_ADMIN";

export type ChatbotToolName =
  | "getPublicBusinessInfo"
  | "getCustomerOwnOrderStatus"
  | "createSupportTicket"
  | "appendSupportMessage"
  | "requestSupportHandoff"
  | "getBusinessOwnerSummary"
  | "getAssignedSupportTickets";

export type BlockedChatbotToolName =
  | "listAllBusinesses"
  | "listAllCustomers"
  | "listAllPayments"
  | "listAllSupportTickets"
  | "exportData"
  | "accessRawLogs"
  | "accessSecrets"
  | "accessKycDocuments"
  | "accessPayoutBankData";

export type ChatbotSensitiveAction =
  | "view_customer_details"
  | "view_order_details"
  | "change_order_status"
  | "refund_payment"
  | "assign_support_agent"
  | "close_support_ticket"
  | "send_whatsapp_message"
  | "send_email"
  | "access_admin_logs"
  | "access_billing_subscription_data"
  | "access_kyc_payout_bank_data";

const businessRoles = new Set<Role>(["OWNER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"]);

const publicInfoIntents = new Set<SupportChatbotIntent>([
  "greeting",
  "smalltalk",
  "abuse",
  "thanks",
  "product",
  "pricing",
  "demo",
  "account",
  "orders",
  "payments",
  "menu",
  "features",
  "security",
  "refund",
  "whatsapp",
  "handoff",
  "guardrail",
  "fallback"
]);

const customerAuthIntents = new Set<SupportChatbotIntent>([
  ...publicInfoIntents,
  "settings"
]);

const businessOwnerIntents = new Set<SupportChatbotIntent>([
  ...publicInfoIntents,
  "customers",
  "staff",
  "reports",
  "billing",
  "settings",
  "businesses",
  "subscriptions",
  "payouts"
]);

const roleBusinessIntents: Record<Extract<Role, "OWNER" | "MANAGER" | "KITCHEN_STAFF" | "DELIVERY_STAFF">, Set<SupportChatbotIntent>> = {
  OWNER: businessOwnerIntents,
  MANAGER: new Set([
    ...publicInfoIntents,
    "customers",
    "staff",
    "reports",
    "billing",
    "settings",
    "subscriptions",
    "payouts"
  ]),
  KITCHEN_STAFF: new Set([
    "greeting",
    "smalltalk",
    "thanks",
    "orders",
    "menu",
    "account",
    "handoff",
    "guardrail",
    "fallback"
  ]),
  DELIVERY_STAFF: new Set([
    "greeting",
    "smalltalk",
    "thanks",
    "orders",
    "account",
    "handoff",
    "guardrail",
    "fallback"
  ])
};

const supportAgentIntents = new Set<SupportChatbotIntent>([
  "greeting",
  "smalltalk",
  "abuse",
  "thanks",
  "account",
  "orders",
  "payments",
  "menu",
  "customers",
  "staff",
  "reports",
  "billing",
  "settings",
  "businesses",
  "subscriptions",
  "payouts",
  "whatsapp",
  "features",
  "security",
  "refund",
  "handoff",
  "guardrail",
  "fallback"
]);

const allKnownIntents = new Set<SupportChatbotIntent>([
  ...businessOwnerIntents,
  ...supportAgentIntents,
  "product"
]);

const modeToolAllowlist: Record<ChatbotMode, Set<ChatbotToolName>> = {
  PUBLIC_INFO: new Set(["getPublicBusinessInfo", "createSupportTicket", "appendSupportMessage", "requestSupportHandoff"]),
  CUSTOMER_AUTH: new Set([
    "getPublicBusinessInfo",
    "getCustomerOwnOrderStatus",
    "createSupportTicket",
    "appendSupportMessage",
    "requestSupportHandoff"
  ]),
  BUSINESS_OWNER: new Set([
    "getPublicBusinessInfo",
    "getBusinessOwnerSummary",
    "createSupportTicket",
    "appendSupportMessage",
    "requestSupportHandoff"
  ]),
  SUPPORT_AGENT: new Set([
    "getPublicBusinessInfo",
    "getAssignedSupportTickets",
    "appendSupportMessage",
    "requestSupportHandoff"
  ]),
  SUPER_ADMIN: new Set([
    "getPublicBusinessInfo",
    "getAssignedSupportTickets",
    "appendSupportMessage",
    "requestSupportHandoff"
  ])
};

export const blockedChatbotTools = new Set<BlockedChatbotToolName>([
  "listAllBusinesses",
  "listAllCustomers",
  "listAllPayments",
  "listAllSupportTickets",
  "exportData",
  "accessRawLogs",
  "accessSecrets",
  "accessKycDocuments",
  "accessPayoutBankData"
]);

export const chatbotSensitiveActions: ChatbotSensitiveAction[] = [
  "view_customer_details",
  "view_order_details",
  "change_order_status",
  "refund_payment",
  "assign_support_agent",
  "close_support_ticket",
  "send_whatsapp_message",
  "send_email",
  "access_admin_logs",
  "access_billing_subscription_data",
  "access_kyc_payout_bank_data"
];

export const chatbotLimits = {
  maxMessageLength: 600,
  maxRequestBodyBytes: 4096,
  maxToolCallsPerRequest: 3,
  maxContextChars: 1800,
  publicIpMessagesPerMinute: 24,
  authenticatedMessagesPerMinute: 18,
  sessionMessagesPerMinute: 10,
  handoffsPerTenMinutes: 3,
  ticketMessagesPerMinute: 20
} as const;

export function chatbotModeForSession(session: Pick<SessionUser, "role" | "businessId"> | null | undefined): ChatbotMode {
  if (!session) return "PUBLIC_INFO";
  if (session.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (session.role === "SUPPORT_AGENT") return "SUPPORT_AGENT";
  if (session.role === "CUSTOMER") return "CUSTOMER_AUTH";
  if (businessRoles.has(session.role)) return "BUSINESS_OWNER";
  return "PUBLIC_INFO";
}

export function isChatbotIntentAllowed(input: {
  mode: ChatbotMode;
  role?: Role | null;
  intent: SupportChatbotIntent;
}) {
  if (input.intent === "guardrail" || input.intent === "fallback" || input.intent === "abuse") return true;
  if (input.mode === "SUPER_ADMIN") return allKnownIntents.has(input.intent);
  if (input.mode === "SUPPORT_AGENT") return supportAgentIntents.has(input.intent);
  if (input.mode === "CUSTOMER_AUTH") return customerAuthIntents.has(input.intent);
  if (input.mode === "PUBLIC_INFO") return publicInfoIntents.has(input.intent);

  if (input.role && input.role in roleBusinessIntents) {
    return roleBusinessIntents[input.role as keyof typeof roleBusinessIntents].has(input.intent);
  }

  return false;
}

export function chatbotIntentRefusal(intent: SupportChatbotIntent, mode: ChatbotMode) {
  if (mode === "PUBLIC_INFO") {
    return `I can answer public VyapaarMate questions here, but I cannot access private ${intent} data. Log in and use the verified portal or contact support.`;
  }

  return "I cannot access that from this chat mode. Use the verified page for your role or contact support.";
}

export function isChatbotToolAllowed(mode: ChatbotMode, toolName: string): toolName is ChatbotToolName {
  if (blockedChatbotTools.has(toolName as BlockedChatbotToolName)) return false;
  return modeToolAllowlist[mode].has(toolName as ChatbotToolName);
}

export function chatbotToolRefusal(toolName: string) {
  if (blockedChatbotTools.has(toolName as BlockedChatbotToolName)) {
    return "That data is not available to the chatbot. Use an authorized admin workflow with audit logging.";
  }

  return "This chatbot tool is not available for your current role or session.";
}

export function requiresExplicitServerAuthorization(action: string) {
  return chatbotSensitiveActions.includes(action as ChatbotSensitiveAction);
}
