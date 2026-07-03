function visibleTail(value: string, count = 4) {
  return value.slice(Math.max(0, value.length - count));
}

export function maskPhone(value: string | null | undefined) {
  const input = String(value ?? "").trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return "Not provided";
  if (digits.length <= 4) return `****${digits}`;

  const countryPrefix = input.trim().startsWith("+") && digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
  return `${countryPrefix}******${visibleTail(digits)}`;
}

export function maskEmail(value: string | null | undefined) {
  const input = String(value ?? "").trim().toLowerCase();
  const [local, domain] = input.split("@");
  if (!local || !domain) return input ? "masked" : "Not provided";

  const visible = local.length <= 2 ? local[0] ?? "" : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export function maskReference(value: string | null | undefined, visible = 4) {
  const input = String(value ?? "").trim();
  if (!input) return "Not provided";
  if (input.length <= visible) return `****${input}`;
  return `****${input.slice(-visible)}`;
}
