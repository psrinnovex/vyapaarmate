import { maskEmail, maskPhone, maskReference } from "@/lib/privacy";

type LogLevel = "info" | "warn" | "error";

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (/email/i.test(key) && typeof value === "string") return maskEmail(value);
  if (/phone/i.test(key) && typeof value === "string") return maskPhone(value);
  if (/(token|secret|authorization|cookie|signature|password|payload|raw)/i.test(key)) return "[redacted]";
  if (/(upi|account|ifsc)/i.test(key) && typeof value === "string") return maskReference(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message
    };
  }

  if (Array.isArray(value)) {
    if (depth <= 0) return `[array:${value.length}]`;
    return value.slice(0, 8).map((item) => redactValue(key, item, depth - 1));
  }

  if (typeof value === "object") {
    if (depth <= 0) return "[object]";
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue, depth - 1)
      ])
    );
  }

  return value;
}

export function sanitizeLogMetadata(metadata: unknown) {
  return redactValue("metadata", metadata, 3);
}

export function safeLog(level: LogLevel, message: string, metadata?: unknown) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  if (metadata === undefined) {
    logger(message);
    return;
  }

  logger(message, sanitizeLogMetadata(metadata));
}
