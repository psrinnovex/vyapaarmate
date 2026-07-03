import { maskEmail, maskPhone, maskReference } from "@/lib/privacy";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d(?:[\s-]?\d){8}(?!\d)/g;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/g;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const cardPattern = /(?<!\d)(?:\d[ -]?){12,19}(?!\d)/g;
const upiPinPattern = /\b(upi\s*pin|otp|cvv|password|api\s*key|access\s*token|secret|webhook\s*secret)\s*[:= -]*\S+/gi;
const upiIdPattern = /\b[a-z0-9._-]{2,}@[a-z]{2,}\b/gi;
const ifscPattern = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;

export function chatbotTranscriptRetentionDays() {
  const parsed = Number(process.env.CHATBOT_TRANSCRIPT_RETENTION_DAYS ?? "30");
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return Math.min(365, Math.floor(parsed));
}

export function shouldStoreRawChatbotMessages() {
  return process.env.CHATBOT_STORE_RAW_MESSAGES === "true";
}

export function redactChatbotText(value: string | null | undefined) {
  const input = String(value ?? "");
  if (!input) return "";

  return input
    .replace(bearerPattern, "[authorization-redacted]")
    .replace(jwtPattern, "[jwt-redacted]")
    .replace(upiPinPattern, (match) => {
      const [label] = match.split(/[:= -]/);
      return `${label.trim()}: [redacted]`;
    })
    .replace(emailPattern, (match) => maskEmail(match))
    .replace(phonePattern, (match) => maskPhone(match))
    .replace(cardPattern, "[payment-card-redacted]")
    .replace(upiIdPattern, "[upi-id-redacted]")
    .replace(ifscPattern, (match) => maskReference(match));
}

export function storedChatbotMessageBody(value: string) {
  return shouldStoreRawChatbotMessages() ? value : redactChatbotText(value);
}

export function redactChatbotMetadata(value: unknown, depth = 4): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactChatbotText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: redactChatbotText(value.message) };

  if (Array.isArray(value)) {
    if (depth <= 0) return `[array:${value.length}]`;
    return value.slice(0, 20).map((item) => redactChatbotMetadata(item, depth - 1));
  }

  if (typeof value === "object") {
    if (depth <= 0) return "[object]";
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, childValue]) => [
        key,
        /(token|secret|authorization|cookie|signature|password|raw|payload|key)/i.test(key)
          ? "[redacted]"
          : redactChatbotMetadata(childValue, depth - 1)
      ])
    );
  }

  return value;
}
