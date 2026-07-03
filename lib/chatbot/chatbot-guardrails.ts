import { company } from "@/lib/site";
import { redactChatbotText } from "@/lib/chatbot/chatbot-redaction";

export type ChatbotSafetyCategory =
  | "safe"
  | "prompt_injection"
  | "secret_exfiltration"
  | "cross_tenant"
  | "privileged_action"
  | "bulk_pii_export"
  | "admin_internal_data"
  | "unsafe_payment_or_kyc";

export type ChatbotSafetyResult = {
  safe: boolean;
  category: ChatbotSafetyCategory;
  reason: string;
  refusal: string;
  auditEvent?: string;
};

const promptInjectionPatterns = [
  /\bignore (all )?(previous|above|system|developer|hidden) (instructions|messages|rules)?\b/i,
  /\bdisregard (all )?(previous|above|system|developer|hidden)\b/i,
  /\b(system|developer|hidden) prompt\b/i,
  /\b(show|print|reveal|repeat|dump).{0,40}\b(prompt|instruction|hidden rule|policy)\b/i,
  /\bjailbreak\b/i,
  /\bact as (a )?(super admin|admin|owner|support agent|developer)\b/i,
  /\bbypass (rbac|auth|authorization|support assignment|tenant|policy|guardrail)\b/i
];

const secretExfiltrationPatterns = [
  /\b(show|print|reveal|dump|give).{0,40}\b(api key|secret|token|jwt|cookie|authorization|webhook secret|database url|connection string)\b/i,
  /\b(api key|secret key|access token|jwt|database password|service role)\b/i
];

const crossTenantPatterns = [
  /\b(another|other|different) (customer|business|merchant|tenant|user|account)\b/i,
  /\b(show|get|open|fetch|list).{0,40}\b(customer|order|ticket|business).{0,40}\b(not mine|someone else|other)\b/i
];

const privilegedActionPatterns = [
  /\b(refund|reverse|cancel payment|change order status|mark paid|mark delivered|assign agent|close ticket|send whatsapp|send email)\b/i,
  /\b(make me|set me|promote me).{0,20}\b(admin|super admin|owner|support agent)\b/i
];

const bulkPiiPatterns = [
  /\b(export|download|dump|list all|show all).{0,40}\b(customers|users|phone numbers|emails|orders|tickets|businesses)\b/i,
  /\b(give|show|send).{0,40}\b(phone numbers|emails|customer list|user list)\b/i
];

const adminInternalPatterns = [
  /\b(admin logs|raw logs|audit logs|database schema|table schema|prisma schema|sql dump)\b/i,
  /\b(show|dump|export).{0,40}\b(logs|schema|database|tables)\b/i
];

const paymentKycPatterns = [
  /\b(kyc document|bank account|ifsc|payout bank|card number|upi pin|cvv)\b/i,
  /\b(show|export|download).{0,40}\b(kyc|bank|payout|payment data)\b/i
];

export function analyzeChatbotSafety(message: string): ChatbotSafetyResult {
  const input = message.trim();

  if (promptInjectionPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "prompt_injection",
      "Prompt-injection or role impersonation request.",
      "I cannot reveal hidden instructions or bypass access rules. I can help with VyapaarMate support tasks through verified pages.",
      "CHATBOT_PROMPT_INJECTION_BLOCKED"
    );
  }

  if (secretExfiltrationPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "secret_exfiltration",
      "Request for secrets, credentials, tokens, or private configuration.",
      "I cannot reveal secrets, tokens, keys, cookies, database URLs, or internal configuration. Use secure admin settings or contact support.",
      "CHATBOT_SECRET_REQUEST_BLOCKED"
    );
  }

  if (crossTenantPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "cross_tenant",
      "Request appears to target another tenant or customer.",
      "I cannot access another customer or business account. Use your verified portal for your own records.",
      "CHATBOT_CROSS_TENANT_REQUEST_BLOCKED"
    );
  }

  if (bulkPiiPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "bulk_pii_export",
      "Bulk personal-data export request.",
      "I cannot export customer lists, phone numbers, emails, or private records from chat. Use authorized exports with audit logging.",
      "CHATBOT_BULK_PII_REQUEST_BLOCKED"
    );
  }

  if (adminInternalPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "admin_internal_data",
      "Request for internal logs, database schema, or admin-only records.",
      "I cannot expose internal logs, database schema, or admin-only records in chat. Use the verified admin console if authorized.",
      "CHATBOT_INTERNAL_DATA_REQUEST_BLOCKED"
    );
  }

  if (paymentKycPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "unsafe_payment_or_kyc",
      "Request includes payment, KYC, or bank-data risk.",
      "Do not share bank, KYC, card, OTP, CVV, or UPI PIN details here. Use the secure verified workflow.",
      "CHATBOT_PAYMENT_KYC_REQUEST_BLOCKED"
    );
  }

  if (privilegedActionPatterns.some((pattern) => pattern.test(input))) {
    return unsafe(
      "privileged_action",
      "Request asks chat to perform a sensitive action.",
      "I cannot perform refunds, assignments, status changes, emails, or WhatsApp sends from chat. Use the verified workflow for your role.",
      "CHATBOT_PRIVILEGED_ACTION_BLOCKED"
    );
  }

  return {
    safe: true,
    category: "safe",
    reason: "No unsafe chatbot pattern detected.",
    refusal: ""
  };
}

export function filterChatbotReply(value: string) {
  const redacted = redactChatbotText(value).trim();
  if (!redacted) return `I could not answer safely. Email ${company.supportEmail}.`;

  if (
    /\b(system|developer|hidden) prompt\b/i.test(redacted) ||
    /\b(api key|secret|token|jwt|database url|connection string)\b/i.test(redacted)
  ) {
    return "I cannot reveal internal instructions, secrets, or private system details.";
  }

  return redacted;
}

function unsafe(
  category: Exclude<ChatbotSafetyCategory, "safe">,
  reason: string,
  refusal: string,
  auditEvent: string
): ChatbotSafetyResult {
  return {
    safe: false,
    category,
    reason,
    refusal,
    auditEvent
  };
}
