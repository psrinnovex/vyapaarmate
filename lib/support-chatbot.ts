import { subscriptionPlanAmounts } from "@/lib/billing";
import { pricingPolicy } from "@/lib/constants";
import { company } from "@/lib/site";
import { formatINR } from "@/lib/utils";

export const supportReplyWordLimit = 34;

export type SupportPortal = "public" | "customer" | "business" | "support" | "admin";
type SupportConfidence = "high" | "medium" | "low";

const businessSessionRoles = new Set(["OWNER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"]);

export type SupportChatbotIntent =
  | "greeting"
  | "smalltalk"
  | "abuse"
  | "thanks"
  | "product"
  | "pricing"
  | "demo"
  | "account"
  | "orders"
  | "payments"
  | "menu"
  | "customers"
  | "staff"
  | "reports"
  | "billing"
  | "settings"
  | "businesses"
  | "subscriptions"
  | "payouts"
  | "whatsapp"
  | "features"
  | "security"
  | "refund"
  | "handoff"
  | "guardrail"
  | "fallback";

export type SupportChatbotAction = {
  label: string;
  href: string;
  tone?: "primary" | "secondary" | "urgent";
};

export type SupportChatbotReply = {
  intent: SupportChatbotIntent;
  portal: SupportPortal;
  reply: string;
  confidence: SupportConfidence;
  escalate: boolean;
  safe: boolean;
  actions: SupportChatbotAction[];
};

export type SupportChatbotInput = {
  message: string;
  path?: string | null;
  sessionRole?: string | null;
};

export const supportChatbotIntents: Array<{
  id: Exclude<SupportChatbotIntent, "guardrail" | "fallback">;
  label: string;
  owner: string;
  trigger: string;
  outcome: string;
}> = [
  {
    id: "smalltalk",
    label: "Small talk",
    owner: "Bot",
    trigger: "hi, how are you, thanks, rude language",
    outcome: "Reply naturally, set boundaries, and guide back to the task."
  },
  {
    id: "pricing",
    label: "Pricing",
    owner: "Sales",
    trigger: "price, plan, cost, subscription",
    outcome: "Send plan summary and pricing page."
  },
  {
    id: "demo",
    label: "Demo and setup",
    owner: "Onboarding",
    trigger: "demo, setup, onboarding, contact",
    outcome: "Collect workflow details and send contact page."
  },
  {
    id: "account",
    label: "Account access",
    owner: "Support",
    trigger: "login, register, dashboard, verification",
    outcome: "Route to login/register and avoid credential collection."
  },
  {
    id: "payments",
    label: "Payments",
    owner: "Payments",
    trigger: "UPI, QR, Cashfree, invoice",
    outcome: "Ask for reference IDs only and escalate failures."
  },
  {
    id: "menu",
    label: "Menu and catalog",
    owner: "Merchant support",
    trigger: "menu, catalog, item, category, price, availability, image",
    outcome: "Route business users to menu controls and customers to public stores."
  },
  {
    id: "customers",
    label: "Customer CRM",
    owner: "Merchant support",
    trigger: "customer, CRM, repeat buyer, opt-in, contact, history",
    outcome: "Explain customer records, consent, and safe customer-data handling."
  },
  {
    id: "staff",
    label: "Staff and roles",
    owner: "Operations",
    trigger: "staff, manager, kitchen, delivery, permission, role",
    outcome: "Route to staff management and role-appropriate access guidance."
  },
  {
    id: "reports",
    label: "Reports",
    owner: "Analytics",
    trigger: "report, analytics, sales, summary, performance, dashboard",
    outcome: "Route to dashboard reporting and explain available business metrics."
  },
  {
    id: "billing",
    label: "Billing",
    owner: "Billing",
    trigger: "billing, invoice, plan, subscription checkout, renewal",
    outcome: "Separate business subscriptions from customer order payments."
  },
  {
    id: "settings",
    label: "Settings",
    owner: "Onboarding",
    trigger: "settings, profile, location, service area, hours, phone",
    outcome: "Route to the correct profile, business, or platform settings page."
  },
  {
    id: "businesses",
    label: "Business approval",
    owner: "Platform admin",
    trigger: "business approval, verification, suspend, active, service area",
    outcome: "Route admin users to business review without exposing private data."
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    owner: "Billing",
    trigger: "subscription, trial, active, past due, renewal",
    outcome: "Route admin and business users to subscription state and invoices."
  },
  {
    id: "payouts",
    label: "Payouts",
    owner: "Payments",
    trigger: "payout, wallet, settlement, platform fee, transfer",
    outcome: "Explain platform-wallet flow and route admin payout review."
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    owner: "Integrations",
    trigger: "WhatsApp, template, Cloud API, campaign",
    outcome: "Explain approval/setup path and send support handoff."
  },
  {
    id: "orders",
    label: "Orders / bookings",
    owner: "Merchant support",
    trigger: "order, booking, status, cancel, catalog",
    outcome: "Send tracking guidance and business contact path."
  },
  {
    id: "security",
    label: "Security",
    owner: "Platform",
    trigger: "security, privacy, data, tenant, audit",
    outcome: "Explain controls without exposing internals."
  },
  {
    id: "handoff",
    label: "Agent support",
    owner: "Support lead",
    trigger: "urgent, bug, broken, complaint, human",
    outcome: "Collect safe identifiers and place the request in the agent queue."
  }
];

export const supportEscalationRules = [
  "Payment failures, refunds, duplicate charges, or missing wallet credits.",
  "Business verification, WhatsApp approval, webhook, or gateway setup issues.",
  "Security concerns, account access trouble, privacy requests, or suspected abuse.",
  "Any request containing secrets, OTPs, UPI PINs, tokens, or full card details."
];

export const supportBotGuardrails = [
  "Never ask for passwords, OTPs, UPI PINs, access tokens, or full card numbers.",
  "Keep every bot reply under 34 words.",
  "Render text only; never execute user-provided HTML or scripts.",
  "Rate limit by IP and browser session before answering.",
  "Resolve admin and business context from verified session roles, not browser-supplied paths.",
  "Assign account, payment, security, and approval issues to agents."
];

const supportEmailAction: SupportChatbotAction = {
  label: "Email support",
  href: `mailto:${company.supportEmail}`,
  tone: "urgent"
};

const actionsByIntent: Partial<Record<SupportChatbotIntent, SupportChatbotAction[]>> = {
  product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" }
  ],
  pricing: [
    { label: "Pricing", href: "/pricing" },
    { label: "Register", href: "/register" }
  ],
  demo: [
    { label: "Contact", href: "/contact" },
    { label: "Demo store", href: "/b/sri-sai-tiffins" }
  ],
  account: [
    { label: "Login", href: "/login" },
    { label: "Register", href: "/register" }
  ],
  orders: [
    { label: "Demo store", href: "/b/sri-sai-tiffins" },
    { label: "Contact", href: "/contact" }
  ],
  payments: [
    { label: "Contact", href: "/contact" },
    supportEmailAction
  ],
  menu: [
    { label: "Demo store", href: "/b/sri-sai-tiffins" },
    { label: "Features", href: "/features" }
  ],
  customers: [
    { label: "Features", href: "/features" },
    { label: "Contact", href: "/contact" }
  ],
  staff: [
    { label: "Features", href: "/features" },
    { label: "Contact", href: "/contact" }
  ],
  reports: [
    { label: "Features", href: "/features" },
    { label: "Contact", href: "/contact" }
  ],
  billing: [
    { label: "Pricing", href: "/pricing" },
    { label: "Register", href: "/register" }
  ],
  settings: [
    { label: "Login", href: "/login" },
    { label: "Contact", href: "/contact" }
  ],
  businesses: [
    { label: "Businesses", href: "/businesses" },
    { label: "Register", href: "/register" }
  ],
  subscriptions: [
    { label: "Pricing", href: "/pricing" },
    { label: "Register", href: "/register" }
  ],
  payouts: [
    { label: "Contact", href: "/contact" },
    supportEmailAction
  ],
  whatsapp: [
    { label: "Features", href: "/features" },
    { label: "Contact", href: "/contact" }
  ],
  features: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" }
  ],
  security: [
    { label: "Privacy", href: "/privacy" },
    supportEmailAction
  ],
  refund: [
    { label: "Contact", href: "/contact" },
    supportEmailAction
  ],
  handoff: [
    { label: "Contact", href: "/contact" },
    supportEmailAction
  ],
  guardrail: [supportEmailAction],
  fallback: [
    { label: "Features", href: "/features" },
    { label: "Contact", href: "/contact" }
  ]
};

type IntentMatch = {
  intent: SupportChatbotIntent;
  confidence: SupportConfidence;
  score: number;
};

const intentPriority: Partial<Record<SupportChatbotIntent, number>> = {
  guardrail: 100,
  abuse: 98,
  payments: 92,
  payouts: 91,
  refund: 90,
  menu: 86,
  orders: 84,
  businesses: 82,
  subscriptions: 80,
  billing: 78,
  customers: 76,
  staff: 74,
  reports: 72,
  whatsapp: 70,
  settings: 68,
  security: 66,
  account: 64,
  pricing: 62,
  demo: 60,
  features: 58,
  product: 56,
  handoff: 20,
  smalltalk: 14,
  greeting: 12,
  thanks: 10
};

const keywordRules: Array<{ intent: SupportChatbotIntent; keywords: string[]; weight?: number }> = [
  { intent: "abuse", weight: 5, keywords: ["fuck", "fuck off", "shut up", "idiot", "stupid", "useless", "nonsense", "hate you"] },
  { intent: "thanks", weight: 2, keywords: ["thanks", "thank you", "thx", "ty", "appreciate it"] },
  {
    intent: "smalltalk",
    weight: 1.5,
    keywords: [
      "how are you",
      "how are u",
      "how r you",
      "how r u",
      "hru",
      "how is it going",
      "are you there",
      "can you help",
      "what can you do",
      "sup",
      "whats up"
    ]
  },
  { intent: "pricing", weight: 2, keywords: ["price", "prices", "pricing", "plan", "plans", "cost", "monthly", "charges", "starter", "pro plan"] },
  { intent: "billing", weight: 2, keywords: ["billing", "invoice", "business invoice", "plan invoice", "checkout", "renewal", "billing page", "payment plan"] },
  { intent: "subscriptions", weight: 2.5, keywords: ["subscription", "subscriptions", "trial", "active plan", "past due", "renew subscription", "subscription payment", "subscription status"] },
  { intent: "whatsapp", weight: 2.5, keywords: ["whatsapp", "template", "cloud api", "campaign", "campaigns", "message", "messages", "updates", "waba", "phone number id", "live sends", "opt in"] },
  { intent: "demo", weight: 2, keywords: ["demo", "setup", "set up", "onboard", "onboarding", "contact sales", "call back", "sales call", "book demo"] },
  { intent: "account", weight: 2, keywords: ["login", "log in", "signin", "sign in", "register", "signup", "sign up", "dashboard access", "password reset", "locked account"] },
  { intent: "settings", weight: 2.5, keywords: ["settings", "profile", "business profile", "location", "service area", "hours", "address", "phone number", "display number", "open hours"] },
  { intent: "businesses", weight: 2.5, keywords: ["business approval", "approve business", "business verification", "verify business", "suspend business", "active business", "inactive business", "reject business", "service area approval"] },
  { intent: "refund", weight: 4, keywords: ["refund", "chargeback", "duplicate charge", "wrong charge", "cancel payment", "money back", "reverse payment"] },
  { intent: "payouts", weight: 3, keywords: ["payout", "payouts", "wallet", "wallet credit", "settlement", "settled", "platform fee", "transfer", "available balance", "vendor balance", "utr settlement"] },
  { intent: "payments", weight: 2.5, keywords: ["payment", "payments", "paid", "upi", "qr", "cashfree", "utr", "pending", "failed", "webhook", "gateway", "capture", "cash payment", "mark paid", "payment status"] },
  { intent: "menu", weight: 3, keywords: ["menu", "catalog", "item", "items", "category", "categories", "item price", "menu price", "availability", "out of stock", "image", "photo", "food type", "add item", "edit item"] },
  { intent: "customers", weight: 3, keywords: ["customer", "customers", "crm", "buyer", "repeat buyer", "customer history", "customer phone", "customer contact", "marketing opt in", "opt in"] },
  { intent: "staff", weight: 3, keywords: ["staff", "manager", "kitchen", "delivery staff", "permission", "permissions", "role", "roles", "employee", "team access", "staff access"] },
  { intent: "reports", weight: 3, keywords: ["report", "reports", "analytics", "sales summary", "sales report", "performance", "dashboard metrics", "top items", "revenue"] },
  { intent: "orders", weight: 2.5, keywords: ["order", "orders", "booking", "bookings", "track", "status", "cancel order", "delivery", "pickup", "dine in", "order receipt", "fulfillment"] },
  { intent: "security", weight: 2.5, keywords: ["security", "privacy", "safe", "data", "tenant", "audit", "delete data", "gdpr", "breach", "exposed"] },
  {
    intent: "features",
    weight: 2.25,
    keywords: [
      "feature",
      "features",
      "what can i do",
      "what can you do",
      "what do i do",
      "what can i manage",
      "show options",
      "available options",
      "guide me",
      "dashboard help",
      "restaurant",
      "tiffin",
      "salon",
      "grocery",
      "pharmacy",
      "service business",
      "local business"
    ]
  },
  { intent: "handoff", weight: 1, keywords: ["support", "human", "agent", "urgent", "broken", "bug", "not working", "complaint", "issue", "problem"] },
  { intent: "product", weight: 2, keywords: ["vyapaarmate", "vyapaarbot", "what is this", "what do you do", "about", "who are you"] },
  { intent: "greeting", weight: 1.5, keywords: ["hi", "hello", "hey", "namaste", "good morning", "good evening"] }
];

export const supportKnowledgeDataSets: Array<{ intent: SupportChatbotIntent; keywords: string[]; weight?: number }> = [
  {
    intent: "pricing",
    weight: 2.25,
    keywords: ["fee", "fees", "monthly fee", "yearly", "annual", "annual plan", "commission", "platform commission", "gateway charges", "setup fee", "whatsapp charges", "trial", "free trial"]
  },
  {
    intent: "demo",
    weight: 2.25,
    keywords: ["start business", "launch my store", "go live", "implementation", "training", "migrate catalog", "setup my shop", "setup my restaurant", "sales demo", "schedule demo"]
  },
  {
    intent: "account",
    weight: 2.75,
    keywords: ["forgot password", "reset password", "email verification", "verify email", "phone verification", "cannot login", "cant login", "cannot access", "not able to login", "dashboard not opening", "account locked", "role access"]
  },
  {
    intent: "orders",
    weight: 2.75,
    keywords: ["accept order", "reject order", "order accepted", "preparing order", "mark ready", "mark delivered", "booking slot", "appointment", "reschedule booking", "dine in", "takeaway", "customer address", "fulfillment status"]
  },
  {
    intent: "payments",
    weight: 3,
    keywords: ["online payment", "payment link", "pay now", "scan qr", "manual upi", "customer paid", "paid but pending", "money deducted", "transaction id", "reference number", "cashfree order", "cashfree payment", "payment reminder", "mark as paid"]
  },
  {
    intent: "refund",
    weight: 4.25,
    keywords: ["debited twice", "paid twice", "double payment", "double charged", "payment reversal", "refund status", "refund not received", "charged twice"]
  },
  {
    intent: "menu",
    weight: 3,
    keywords: ["variant", "variants", "addon", "add on", "quantity", "stock", "disable item", "enable item", "item photo", "veg", "non veg", "service duration", "time slot", "catalog image", "menu availability"]
  },
  {
    intent: "customers",
    weight: 3,
    keywords: ["client", "clients", "lead", "leads", "customer list", "phone list", "last order", "repeat order", "customer spend", "buyer history", "consent", "opt out"]
  },
  {
    intent: "staff",
    weight: 3,
    keywords: ["add manager", "remove staff", "disable staff", "owner access", "manager access", "kitchen role", "delivery role", "least privilege", "staff permission", "team member"]
  },
  {
    intent: "reports",
    weight: 3,
    keywords: ["daily sales", "sales summary", "order history", "top item", "top items", "pending payment report", "cash summary", "business performance", "revenue report", "closing report"]
  },
  {
    intent: "billing",
    weight: 2.75,
    keywords: ["tax invoice", "gst", "plan invoice", "subscription invoice", "billing history", "invoice download", "receipt", "plan receipt"]
  },
  {
    intent: "settings",
    weight: 2.75,
    keywords: ["business hours", "delivery radius", "service radius", "pincode", "pin code", "map pin", "store profile", "shop profile", "display phone", "business address", "open close time"]
  },
  {
    intent: "businesses",
    weight: 3,
    keywords: ["kyc", "approval pending", "verification pending", "verify store", "business status", "merchant approval", "service area verification", "store suspended"]
  },
  {
    intent: "subscriptions",
    weight: 3,
    keywords: ["plan expired", "expired plan", "upgrade plan", "downgrade plan", "renew plan", "active subscription", "past due payment", "subscription failed"]
  },
  {
    intent: "payouts",
    weight: 3.25,
    keywords: ["bank transfer", "settlement report", "settlement utr", "payout pending", "payout failed", "bank account", "settlement batch", "vendor payout", "wallet balance"]
  },
  {
    intent: "whatsapp",
    weight: 3,
    keywords: ["green tick", "business api", "whatsapp business api", "template pending", "template rejected", "broadcast", "campaign message", "display number", "status update message", "customer notification", "message failed"]
  },
  {
    intent: "features",
    weight: 2.25,
    keywords: ["owner dashboard", "business website", "booking system", "online ordering", "order management", "booking management", "campaign tool", "coupon", "coupons", "invoice system", "local commerce"]
  },
  {
    intent: "security",
    weight: 3,
    keywords: ["privacy policy", "customer data", "data deletion", "delete account", "audit log", "suspicious login", "data access", "private data", "data export"]
  },
  {
    intent: "handoff",
    weight: 1.75,
    keywords: ["talk to person", "real person", "call me", "escalate", "not solved", "still stuck", "need support team", "need human support", "connect support"]
  }
];

const allKeywordRules = [...keywordRules, ...supportKnowledgeDataSets];

const promptInjectionPatterns = [
  /\bignore (all )?(previous|above|system|developer)\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper message\b/i,
  /\bjailbreak\b/i,
  /\bbypass\b/i,
  /\breveal\b.*\b(prompt|secret|token|key)\b/i,
  /\bact as\b/i
];

const sensitivePatterns = [
  /\botp\b/i,
  /\bcvv\b/i,
  /\bupi\s*pin\b/i,
  /\bapi\s*key\b/i,
  /\baccess\s*token\b/i,
  /\bbearer\b/i,
  /\bjwt\b/i,
  /\bsecret\b/i,
  /\bcard\s*number\b/i,
  /\b(my|our)\s+password\s+(is|:)/i,
  /\b\d{12,19}\b/
];

const outOfScopePatterns = [
  /\b(weather|temperature|forecast|cricket score|sports score|movie|song|lyrics|recipe|horoscope)\b/i,
  /\b(capital of|prime minister|president of|latest news|stock price|share price|crypto price)\b/i,
  /\b(write code|debug my code|solve homework|math problem|medical advice|legal advice)\b/i
];

export function sanitizeSupportMessage(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export function sanitizeSupportPath(value: string | null | undefined) {
  if (!value) return null;

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);

  if (!cleaned.startsWith("/") || cleaned.startsWith("//")) return null;

  const pathname = cleaned.split(/[?#]/)[0] ?? "";
  return pathname || "/";
}

export function generateSupportReply(input: SupportChatbotInput): SupportChatbotReply {
  const message = sanitizeSupportMessage(input.message);
  const normalized = expandChatShortcuts(normalizeForMatch(message));
  const path = sanitizeSupportPath(input.path);
  const portal = resolveSupportPortal(path, input.sessionRole);

  if (!message) {
    return buildReply("greeting", greetingForPortal(portal), false, true, portal);
  }

  if (sensitivePatterns.some((pattern) => pattern.test(message))) {
    return buildReply(
      "guardrail",
      "Please do not share secrets here. Use dashboard settings or email support for secure help.",
      true,
      false,
      portal
    );
  }

  if (promptInjectionPatterns.some((pattern) => pattern.test(message))) {
    return buildReply(
      "guardrail",
      "I can help with VyapaarMate support only. Choose pricing, setup, payments, WhatsApp, or account help.",
      false,
      true,
      portal
    );
  }

  if (isOutOfScopeQuestion(message, normalized)) {
    return buildReply("fallback", unknownForPortal(portal), false, true, portal, "low");
  }

  if (isSupportIntakeDetails(message, normalized)) {
    return buildReply(
      "handoff",
      "Got it. These are the right support details. Add phone or order ID if relevant, then use Email support below.",
      true,
      true,
      portal,
      "high"
    );
  }

  const intentMatch = classifyIntent(normalized, portal, path);
  const intent = intentMatch?.intent ?? "fallback";
  const escalate = shouldEscalate(intent, normalized);

  return buildReply(intent, replyForIntent(intent, portal, normalized), escalate, true, portal, intentMatch?.confidence ?? "low");
}

function buildReply(
  intent: SupportChatbotIntent,
  reply: string,
  escalate: boolean,
  safe: boolean,
  portal: SupportPortal,
  confidence: SupportConfidence = defaultConfidenceForIntent(intent)
): SupportChatbotReply {
  return {
    intent,
    portal,
    reply: enforceWordLimit(reply),
    confidence,
    escalate,
    safe,
    actions: actionsForIntent(intent, portal)
  };
}

function defaultConfidenceForIntent(intent: SupportChatbotIntent): SupportConfidence {
  return intent === "fallback" ? "low" : intent === "guardrail" ? "medium" : "high";
}

function shouldEscalate(intent: SupportChatbotIntent, normalizedMessage: string) {
  if (intent === "handoff" || intent === "refund" || intent === "security") return true;
  if (containsAny(normalizedMessage, ["human", "agent", "urgent", "complaint", "not working", "broken", "bug"])) return true;
  if (intent === "payments" && containsAny(normalizedMessage, ["failed", "pending", "refund", "duplicate", "not received", "missing", "webhook"])) return true;
  if (intent === "payouts" && containsAny(normalizedMessage, ["failed", "pending", "not received", "missing", "settlement"])) return true;
  if (intent === "account" && containsAny(normalizedMessage, ["locked", "account locked", "cannot login", "cant login", "not able login", "cannot access", "dashboard not opening"])) return true;
  return false;
}

function replyForIntent(intent: SupportChatbotIntent, portal: SupportPortal, normalizedMessage = "") {
  switch (intent) {
    case "greeting":
      return greetingForPortal(portal);
    case "smalltalk":
      return "I'm good, thanks. Tell me what you're trying to do, and I'll guide you step by step.";
    case "abuse":
      return "I'm here to help, but I won't respond to abuse. Tell me the issue and I'll keep it clear.";
    case "thanks":
      return "You're welcome. If anything is stuck, send the page name and what happened.";
    case "product":
      return "VyapaarMate helps local businesses take website orders, collect UPI payments, and send WhatsApp updates.";
    case "pricing":
      return `Starter is ${formatINR(subscriptionPlanAmounts.STARTER)}/month. Pro is ${formatINR(subscriptionPlanAmounts.PRO)}/month. Setup is usually ${pricingPolicy.setupFeeRange}, scoped separately.`;
    case "demo":
      return "Book a demo from Contact. Share business type, catalog size, payments, and WhatsApp needs.";
    case "account":
      return portal === "admin"
        ? "Use admin access only after verified login. For account trouble, check role, staff identity, and audit logs."
        : portal === "support"
          ? "Use VyapaarMate Support after verified login. For account trouble, confirm role and ticket details without sharing secrets."
          : portal === "business"
            ? "Use dashboard Settings or Staff. For login trouble, reset password; never share OTPs or passwords in chat."
            : portal === "customer"
              ? "Use User Portal for bookings, profile, and settings. For login trouble, reset password; never share OTPs."
              : "Use Login for access. If registration is pending, verify email and phone or contact support.";
    case "orders":
      return portal === "business"
        ? "Open Orders to review status, update fulfillment, and resend WhatsApp updates if enabled."
        : portal === "customer"
          ? "Open User Portal Bookings or your order link to track status. For changes, contact the business directly."
          : "Open your order link to track status. For changes, contact the business directly.";
    case "payments":
      return portal === "admin"
        ? "Review payment state, provider reference, wallet entry, and audit trail. Never verify from screenshots alone."
        : portal === "support"
          ? "Review ticket payment reference, order ID, business name, and escalation notes. Never verify from screenshots alone."
          : portal === "business"
            ? "Open Payments to check status, provider reference, reminders, wallet credit, and invoice email."
            : portal === "customer"
              ? "Open User Portal Bookings or the order link. Keep UTR, order ID, and business name ready; never share UPI PIN."
              : "For pending payments, keep UTR, order ID, and business name ready. Never share UPI PIN.";
    case "menu":
      return portal === "business"
        ? "Open Menu to manage categories, items, prices, availability, images, and service options."
        : portal === "customer"
          ? "Open the business page to view current items, availability, prices, and booking options."
          : portal === "admin"
            ? "Use Businesses to review catalog setup only for verified merchants; avoid editing merchant data without request."
            : portal === "support"
              ? "Use the ticket context to guide catalog setup. Do not edit merchant data without a verified request."
              : "Open the demo store or Features page to see menu, catalog, item, price, and availability workflows.";
    case "customers":
      return portal === "business"
        ? "Open Customers to review repeat buyers, opt-ins, totals, last order, and safe contact details."
        : portal === "admin"
          ? "Use admin pages only for support-approved customer-data checks. Do not expose private customer details in chat."
          : portal === "support"
            ? "Use support ticket context only. Do not expose private customer details or payment data in chat."
            : "Customer records are available to verified businesses with consent-aware CRM and repeat-order history.";
    case "staff":
      return portal === "business"
        ? "Open Staff to add managers, kitchen, or delivery roles and keep each person on least-privilege access."
        : portal === "admin"
          ? "Check business role setup from Businesses or Support. Never request staff passwords, OTPs, or private tokens."
          : portal === "support"
            ? "Guide role setup from verified support tickets. Never request passwords, OTPs, or private tokens."
            : "Staff roles are available inside approved business dashboards for owners and managers.";
    case "reports":
      return portal === "business"
        ? "Open Reports for sales, orders, bookings, top items, pending payments, and performance trends."
        : portal === "admin"
          ? "Use admin logs and reports only for platform review, billing, security, and support investigations."
          : portal === "support"
            ? "Use ticket details and scoped logs for support investigations. Avoid exposing private metrics in chat."
            : "Reports show sales, booking, payment, customer, and item trends after a business starts using VyapaarMate.";
    case "billing":
      return portal === "business"
        ? "Open Billing for plan, checkout, invoices, and subscription status. Use Payments for customer order payments."
        : portal === "admin"
          ? "Use Subscriptions for merchant plan state and Admin Payments for UPI verification or platform wallet entries."
          : portal === "support"
            ? "Use ticket details for plan, invoice, checkout, and payment status before escalation."
            : "Billing covers business plans and invoices. Customer order payments are handled through booking or order links.";
    case "settings":
      return portal === "business"
        ? "Open Settings for profile, location, service area, hours, WhatsApp display number, and dashboard controls."
        : portal === "customer"
          ? "Open Profile or Settings to manage your user details. Never share OTPs, passwords, or payment PINs in chat."
          : portal === "admin"
            ? "Use admin settings carefully with audit logs. Change tenant, payment, or WhatsApp data only from verified workflows."
            : portal === "support"
              ? "Guide secure settings changes from verified ticket context. Never request secrets, tokens, OTPs, or passwords."
              : "Use Login first, then open the right portal settings for user, business, or support changes.";
    case "businesses":
      return portal === "admin"
        ? "Open Businesses to approve, reject, suspend, verify service area, and manage WhatsApp or route setup safely."
        : portal === "support"
          ? "Use the support ticket to triage business approval, KYC, WhatsApp, or setup status and escalate when needed."
          : "Business approvals are handled by VyapaarMate Support. Register your business, then wait for verification or contact support.";
    case "subscriptions":
      return portal === "admin"
        ? "Open Subscriptions to review plan, amount, payment state, UPI reference, active status, or past-due renewal."
        : portal === "support"
          ? "Review subscription ticket details, plan, amount, payment state, and renewal issue before escalation."
          : portal === "business"
            ? "Open Billing to view subscription plan, checkout status, invoices, and renewal details."
            : "Subscriptions are for business accounts. Customers can use bookings and order links without a business plan.";
    case "payouts":
      return portal === "admin"
        ? "Open Admin Payments to review wallet credits, the 9 AM payout batch, payout records, and UTR before marking settled."
        : portal === "support"
          ? "Use support ticket details for wallet, 9 AM payout batch status, payout reference, and business name before escalation."
          : portal === "business"
            ? "Online payments credit the business wallet and are paid to the saved payout destination in the daily 9 AM IST batch within 24 hours."
            : "Payouts are reviewed by VyapaarMate Support for approved businesses. Keep order IDs, UTRs, and business name ready.";
    case "whatsapp":
      return portal === "admin"
        ? "Check business WhatsApp status, token setup, templates, provider logs, and approval before enabling messages."
        : portal === "support"
          ? "Check ticket details for WhatsApp setup, templates, consent, provider logs, and approval status."
          : portal === "business"
            ? "Open Settings or Campaigns to review WhatsApp setup, templates, customer consent, and message status."
            : "WhatsApp goes live after support setup, secure token storage, template checks, and approval.";
    case "features":
      return portal === "business"
        ? "You can manage orders, catalog, payments, customers, campaigns, staff, reports, and settings. Tell me the task and I'll route you."
        : portal === "customer"
          ? "You can track bookings, payment status, profile details, and business pages. Tell me which one you need."
          : portal === "admin"
            ? "You can review payments, businesses, subscriptions, support, logs, and platform settings from verified admin pages."
            : portal === "support"
              ? "You can triage tickets, payments, account access, WhatsApp setup, and escalations from the support queue."
              : "VyapaarMate supports ordering, bookings, UPI QR, WhatsApp updates, CRM, campaigns, staff, and reports.";
    case "security":
      return portal === "admin"
        ? "Use admin logs and scoped actions. Never expose secrets, tokens, private customer data, or provider credentials in chat."
        : portal === "support"
          ? "Keep support replies scoped. Never expose secrets, tokens, private customer data, or provider credentials in chat."
          : "VyapaarMate uses scoped APIs, validation, secure cookies, rate limits, CSP, and audit logs.";
    case "refund":
      return portal === "admin"
        ? "Check payment, wallet, order, and audit logs before marking refunds or payout adjustments."
        : portal === "support"
          ? "Collect order number, payment reference, business name, and issue summary before escalation."
          : "Refunds need manual review. Share order number, payment reference, and business name with support.";
    case "handoff":
      return "I can place this in the agent queue. Send issue, business name, phone, and order ID if any.";
    case "guardrail":
      return "Please do not share secrets here. Use dashboard settings or email support for secure help.";
    case "fallback":
    default:
      return fallbackForPortal(portal, normalizedMessage);
  }
}

function actionsForIntent(intent: SupportChatbotIntent, portal: SupportPortal): SupportChatbotAction[] {
  if (intent === "abuse" || intent === "smalltalk" || intent === "thanks" || intent === "greeting" || intent === "fallback") {
    return portalStarterActions(portal);
  }

  if (intent === "handoff") {
    return supportHandoffActions(portal);
  }

  if (portal === "support") {
    return [
      { label: "Support", href: "/support", tone: "primary" },
      supportEmailAction
    ];
  }

  if (portal === "admin") {
    if (intent === "payments" || intent === "refund" || intent === "payouts") {
      return [
        { label: "Payments", href: "/admin/payments", tone: "primary" },
        { label: "Support", href: "/admin/support" }
      ];
    }
    if (intent === "businesses" || intent === "whatsapp" || intent === "account" || intent === "menu" || intent === "customers" || intent === "staff") {
      return [
        { label: "Businesses", href: "/admin/businesses", tone: "primary" },
        { label: "Support", href: "/admin/support" }
      ];
    }
    if (intent === "subscriptions" || intent === "billing" || intent === "pricing") {
      return [
        { label: "Subscriptions", href: "/admin/subscriptions", tone: "primary" },
        { label: "Payments", href: "/admin/payments" }
      ];
    }
    if (intent === "security" || intent === "reports" || intent === "settings") {
      return [
        { label: "Logs", href: "/admin/logs", tone: "primary" },
        { label: "Support", href: "/admin/support" }
      ];
    }
    return [
      { label: "Admin", href: "/admin", tone: "primary" },
      { label: "Support", href: "/admin/support" }
    ];
  }

  if (portal === "business") {
    if (intent === "features" || intent === "product") {
      return [
        { label: "Orders", href: "/dashboard/orders", tone: "primary" },
        { label: "Menu", href: "/dashboard/menu" },
        { label: "Payments", href: "/dashboard/payments" }
      ];
    }
    if (intent === "menu") {
      return [
        { label: "Menu", href: "/dashboard/menu", tone: "primary" },
        { label: "Orders", href: "/dashboard/orders" }
      ];
    }
    if (intent === "orders") {
      return [
        { label: "Orders", href: "/dashboard/orders", tone: "primary" },
        { label: "Menu", href: "/dashboard/menu" }
      ];
    }
    if (intent === "customers") {
      return [
        { label: "Customers", href: "/dashboard/customers", tone: "primary" },
        { label: "Campaigns", href: "/dashboard/campaigns" }
      ];
    }
    if (intent === "staff") {
      return [
        { label: "Staff", href: "/dashboard/staff", tone: "primary" },
        { label: "Settings", href: "/dashboard/settings" }
      ];
    }
    if (intent === "reports") {
      return [
        { label: "Reports", href: "/dashboard/reports", tone: "primary" },
        { label: "Payments", href: "/dashboard/payments" }
      ];
    }
    if (intent === "payments" || intent === "refund" || intent === "payouts") {
      return [
        { label: "Payments", href: "/dashboard/payments", tone: "primary" },
        { label: "Billing", href: "/dashboard/billing" }
      ];
    }
    if (intent === "billing" || intent === "subscriptions" || intent === "pricing") {
      return [
        { label: "Billing", href: "/dashboard/billing", tone: "primary" },
        { label: "Pricing", href: "/pricing" }
      ];
    }
    if (intent === "whatsapp") {
      return [
        { label: "Settings", href: "/dashboard/settings", tone: "primary" },
        { label: "Campaigns", href: "/dashboard/campaigns" }
      ];
    }
    if (intent === "settings" || intent === "account") {
      return [
        { label: "Settings", href: "/dashboard/settings", tone: "primary" },
        { label: "Staff", href: "/dashboard/staff" }
      ];
    }
    return [
      { label: "Dashboard", href: "/dashboard", tone: "primary" },
      { label: "Settings", href: "/dashboard/settings" }
    ];
  }

  if (portal === "customer") {
    if (intent === "features" || intent === "product") {
      return [
        { label: "Bookings", href: "/user/bookings", tone: "primary" },
        { label: "Businesses", href: "/businesses" }
      ];
    }
    if (intent === "orders" || intent === "payments" || intent === "refund") {
      return [
        { label: "Bookings", href: "/user/bookings", tone: "primary" },
        supportEmailAction
      ];
    }
    if (intent === "account" || intent === "settings") {
      return [
        { label: "Profile", href: "/user/profile", tone: "primary" },
        { label: "Settings", href: "/user/settings" }
      ];
    }
    if (intent === "menu" || intent === "businesses") {
      return [
        { label: "Businesses", href: "/businesses", tone: "primary" },
        { label: "Bookings", href: "/user/bookings" }
      ];
    }
    return [
      { label: "User Portal", href: "/user", tone: "primary" },
      { label: "Bookings", href: "/user/bookings" }
    ];
  }

  return actionsByIntent[intent] ?? actionsByIntent.fallback ?? [];
}

function supportHandoffActions(portal: SupportPortal): SupportChatbotAction[] {
  if (portal === "admin") {
    return [
      { label: "Support", href: "/admin/support", tone: "primary" },
      supportEmailAction
    ];
  }

  if (portal === "support") {
    return [
      { label: "Support", href: "/support", tone: "primary" },
      supportEmailAction
    ];
  }

  return [
    { label: "Contact", href: "/contact", tone: "primary" },
    supportEmailAction
  ];
}

function portalStarterActions(portal: SupportPortal): SupportChatbotAction[] {
  switch (portal) {
    case "admin":
      return [
        { label: "Support", href: "/admin/support", tone: "primary" },
        { label: "Payments", href: "/admin/payments" }
      ];
    case "support":
      return [
        { label: "Support", href: "/support", tone: "primary" },
        supportEmailAction
      ];
    case "business":
      return [
        { label: "Orders", href: "/dashboard/orders", tone: "primary" },
        { label: "Payments", href: "/dashboard/payments" }
      ];
    case "customer":
      return [
        { label: "User Portal", href: "/user", tone: "primary" },
        { label: "Bookings", href: "/user/bookings" }
      ];
    case "public":
    default:
      return [
        { label: "Features", href: "/features", tone: "primary" },
        { label: "Contact", href: "/contact" }
      ];
  }
}

function greetingForPortal(portal: SupportPortal) {
  switch (portal) {
    case "admin":
      return "Hi, I'm VyapaarBot. I can help review payments, businesses, WhatsApp setup, subscriptions, logs, or escalations.";
    case "support":
      return "Hi, I'm VyapaarBot. I can help with support escalations, customer follow-up, payments, WhatsApp setup, or account access.";
    case "business":
      return "Hi, I'm VyapaarBot. I can help with orders, menu, payments, customers, campaigns, reports, or settings.";
    case "customer":
      return "Hi, I'm VyapaarBot. I can help with your user portal, bookings, payments, store details, or contacting the business.";
    case "public":
    default:
      return "Hi, I'm VyapaarBot. I can help with pricing, demos, payments, WhatsApp, orders, or setup.";
  }
}

function fallbackForPortal(portal: SupportPortal, normalizedMessage = "") {
  if (hasCorrectionSignal(normalizedMessage)) {
    return portal === "business"
      ? "Understood. Tell me what you want instead: orders, catalog, payments, customers, staff, reports, settings, or agent support."
      : portal === "customer"
        ? "Understood. Tell me what you want instead: booking status, payment help, profile changes, business contact, or agent support."
        : "Understood. Tell me what you want instead: pricing, demo, payment help, WhatsApp setup, account help, or agent support.";
  }

  if (normalizedMessage.split(/\s+/).filter(Boolean).length <= 2) {
    return "I don't know enough yet. Send a few more words, like payment pending, WhatsApp setup, pricing, or order or booking status.";
  }

  if (normalizedMessage.includes("please") || normalizedMessage.includes("can you") || normalizedMessage.endsWith("help")) {
    return "I don't know enough yet. Tell me the page, what you clicked, and what result you expected.";
  }

  switch (portal) {
    case "admin":
      return "I don't know enough yet. Send admin page, business name, reference ID, and what failed.";
    case "support":
      return "I don't know enough yet. Send ticket code, business name, reference ID, and what failed.";
    case "business":
      return "I don't know enough yet. Send dashboard page, order or payment ID, and what you expected.";
    case "customer":
      return "I don't know enough yet. Send user portal page, order link, payment reference, or business name.";
    case "public":
    default:
      return "I don't know enough yet. Send your business type, goal, and where you're stuck.";
  }
}

function unknownForPortal(portal: SupportPortal) {
  switch (portal) {
    case "admin":
      return "I don't know that. I can help with verified admin payments, businesses, subscriptions, support, logs, and settings.";
    case "support":
      return "I don't know that. I can help with tickets, payments, account access, WhatsApp setup, and support escalations.";
    case "business":
      return "I don't know that. I can help with dashboard orders, catalog, payments, customers, staff, reports, billing, settings, and support.";
    case "customer":
      return "I don't know that. I can help with bookings, payments, profile, business pages, and contacting support.";
    case "public":
    default:
      return "I don't know that. I can help with VyapaarMate pricing, demo, payments, WhatsApp, orders, setup, or support.";
  }
}

function classifyIntent(normalizedMessage: string, portal: SupportPortal, path: string | null | undefined): IntentMatch | null {
  if (!normalizedMessage) return null;

  const scores = new Map<SupportChatbotIntent, number>();
  const wordCount = normalizedMessage.split(/\s+/).filter(Boolean).length;
  const bumpScore = (intent: SupportChatbotIntent, amount: number) => {
    scores.set(intent, (scores.get(intent) ?? 0) + amount);
  };

  for (const rule of allKeywordRules) {
    for (const keyword of rule.keywords) {
      if (hasKeyword(normalizedMessage, keyword)) {
        bumpScore(rule.intent, rule.weight ?? 1);
      }
    }
  }

  const textMatched = scores.size > 0;
  const pathIntent = inferIntentFromPath(path, portal);
  if (pathIntent) {
    if (hasPathContextSignal(normalizedMessage)) {
      bumpScore(pathIntent, 3.25);
    } else if (textMatched) {
      bumpScore(pathIntent, wordCount <= 6 ? 0.5 : 0.25);
    }
  }

  const nonHandoffScore = Array.from(scores.entries()).reduce((maxScore, [intent, score]) => {
    if (intent === "handoff" || intent === "greeting" || intent === "smalltalk" || intent === "thanks") return maxScore;
    return Math.max(maxScore, score);
  }, 0);

  if ((scores.get("handoff") ?? 0) > 0 && nonHandoffScore >= 1) {
    scores.set("handoff", Math.min(scores.get("handoff") ?? 0, 0.75));
  }

  const ranked = Array.from(scores.entries())
    .filter(([, score]) => score > 0)
    .sort(([leftIntent, leftScore], [rightIntent, rightScore]) => {
      if (rightScore !== leftScore) return rightScore - leftScore;
      return (intentPriority[rightIntent] ?? 0) - (intentPriority[leftIntent] ?? 0);
    });

  if (ranked.length === 0) return null;

  const [intent, score] = ranked[0]!;
  const secondScore = ranked[1]?.[1] ?? 0;
  const confidence: SupportConfidence =
    score >= 4 || score - secondScore >= 2
      ? "high"
      : score >= 1.5 || intent === pathIntent
        ? "medium"
        : "low";

  return { intent, confidence, score };
}

function hasPathContextSignal(normalizedMessage: string) {
  return containsAny(normalizedMessage, [
    "this page",
    "this screen",
    "this section",
    "current page",
    "current screen",
    "current section",
    "on this page",
    "on this screen",
    "what can i do here",
    "how do i use this page",
    "how do i use this screen"
  ]);
}

function hasCorrectionSignal(normalizedMessage: string) {
  return (
    /\b(dont|don t|do not|didnt|didn t)\s+(want|need|like)\b/.test(normalizedMessage) ||
    containsAny(normalizedMessage, [
      "not this",
      "wrong answer",
      "not helpful",
      "bad answer",
      "not what i asked",
      "not useful",
      "no thanks"
    ])
  );
}

function isOutOfScopeQuestion(message: string, normalizedMessage: string) {
  if (containsAny(normalizedMessage, ["vyapaarmate", "vyapaarbot", "payment", "order", "booking", "business", "dashboard", "support"])) {
    return false;
  }

  return outOfScopePatterns.some((pattern) => pattern.test(message));
}

function inferIntentFromPath(path: string | null | undefined, portal: SupportPortal): SupportChatbotIntent | null {
  if (!path) return null;

  if (portal === "support") {
    if (isPathWithin(path, "/support") || isPathWithin(path, "/admin/support")) return "handoff";
  }

  if (portal === "admin") {
    if (isPathWithin(path, "/admin/payments")) return "payments";
    if (isPathWithin(path, "/admin/businesses")) return "businesses";
    if (isPathWithin(path, "/admin/subscriptions")) return "subscriptions";
    if (isPathWithin(path, "/admin/support")) return "handoff";
    if (isPathWithin(path, "/admin/logs")) return "security";
    if (isPathWithin(path, "/admin/settings")) return "settings";
    if (isPathWithin(path, "/admin/orders")) return "orders";
  }

  if (portal === "business") {
    if (isPathWithin(path, "/dashboard/orders")) return "orders";
    if (isPathWithin(path, "/dashboard/menu")) return "menu";
    if (isPathWithin(path, "/dashboard/payments")) return "payments";
    if (isPathWithin(path, "/dashboard/billing")) return "billing";
    if (isPathWithin(path, "/dashboard/customers")) return "customers";
    if (isPathWithin(path, "/dashboard/campaigns")) return "whatsapp";
    if (isPathWithin(path, "/dashboard/settings")) return "settings";
    if (isPathWithin(path, "/dashboard/staff")) return "staff";
    if (isPathWithin(path, "/dashboard/reports")) return "reports";
  }

  if (portal === "customer") {
    if (isPathWithin(path, "/user/bookings") || isPathWithin(path, "/order") || isPathWithin(path, "/b") || isPathWithin(path, "/businesses")) {
      return "orders";
    }
    if (isPathWithin(path, "/user/profile") || isPathWithin(path, "/user/settings")) return "settings";
  }

  if (isPathWithin(path, "/pricing")) return "pricing";
  if (isPathWithin(path, "/features")) return "features";
  if (isPathWithin(path, "/contact")) return "demo";
  if (isPathWithin(path, "/login") || isPathWithin(path, "/register")) return "account";
  return null;
}

export function resolveSupportPortal(path: string | null | undefined, sessionRole: string | null | undefined): SupportPortal {
  const safePath = sanitizeSupportPath(path);

  if (isPathWithin(safePath, "/support")) {
    return sessionRole === "SUPPORT_AGENT" ? "support" : "public";
  }

  if (isPathWithin(safePath, "/admin/support")) {
    if (sessionRole === "SUPER_ADMIN") return "admin";
    if (sessionRole === "SUPPORT_AGENT") return "support";
    return "public";
  }

  if (isPathWithin(safePath, "/admin")) {
    return sessionRole === "SUPER_ADMIN" ? "admin" : "public";
  }

  if (isPathWithin(safePath, "/dashboard")) {
    return businessSessionRoles.has(sessionRole ?? "") ? "business" : "public";
  }

  if (
    isPathWithin(safePath, "/user") ||
    isPathWithin(safePath, "/businesses") ||
    isPathWithin(safePath, "/b") ||
    isPathWithin(safePath, "/order")
  ) {
    return "customer";
  }

  if (!safePath) {
    if (sessionRole === "SUPER_ADMIN") return "admin";
    if (sessionRole === "SUPPORT_AGENT") return "support";
    if (businessSessionRoles.has(sessionRole ?? "")) return "business";
    if (sessionRole === "CUSTOMER") return "customer";
  }

  return "public";
}

function isPathWithin(path: string | null | undefined, prefix: string) {
  return path === prefix || path?.startsWith(`${prefix}/`) === true;
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandChatShortcuts(value: string) {
  const shortcutMap: Record<string, string> = {
    abt: "about",
    acc: "account",
    bkng: "booking",
    cn: "can",
    cst: "cost",
    cus: "customer",
    demo: "demo",
    hlp: "help",
    hru: "how are you",
    hw: "how",
    info: "information",
    inv: "invoice",
    issuee: "issue",
    lgoin: "login",
    lgin: "login",
    msg: "message",
    msgs: "messages",
    nd: "need",
    ord: "order",
    pmt: "payment",
    pmnt: "payment",
    pymnt: "payment",
    pl: "please",
    pls: "please",
    plz: "please",
    prblm: "problem",
    prob: "problem",
    r: "are",
    reg: "register",
    rqst: "request",
    setup: "setup",
    stat: "status",
    sts: "status",
    sub: "subscription",
    thx: "thanks",
    tnx: "thanks",
    ty: "thanks",
    u: "you",
    ur: "your",
    waba: "waba",
    wa: "whatsapp",
    wat: "what",
    wht: "what",
    whats: "what is",
    wr: "where",
    yr: "your"
  };

  return value
    .split(" ")
    .flatMap((word) => (shortcutMap[word] ?? word).split(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasKeyword(normalizedMessage: string, keyword: string) {
  const normalizedKeyword = expandChatShortcuts(normalizeForMatch(keyword));
  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(" ")) return normalizedMessage.includes(normalizedKeyword);
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedKeyword)}(\\s|$)`).test(normalizedMessage);
}

function containsAny(normalizedMessage: string, words: string[]) {
  return words.some((word) => hasKeyword(normalizedMessage, word));
}

function isSupportIntakeDetails(message: string, normalizedMessage: string) {
  const hasIssueDetail = /\b(issue|problem|complaint)\s*[:=-]/i.test(message) || containsAny(normalizedMessage, ["issue", "problem", "complaint"]);
  const hasIdentifierDetail =
    /\b(business\s+name|phone|mobile|order\s*(id|number|no)|payment\s*(id|reference|ref)|utr)\s*[:=-]/i.test(message) ||
    containsAny(normalizedMessage, ["business name", "phone", "mobile", "order id", "order number", "payment id", "payment reference", "utr"]);

  return hasIssueDetail && hasIdentifierDetail;
}

function enforceWordLimit(reply: string) {
  const words = reply.trim().split(/\s+/);
  if (words.length <= supportReplyWordLimit) return reply;
  return `${words.slice(0, supportReplyWordLimit).join(" ")}.`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
