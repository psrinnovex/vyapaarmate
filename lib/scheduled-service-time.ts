const indiaOffsetMs = 330 * 60 * 1000;
const minimumLeadTimeMs = 15 * 60 * 1000;
const maximumLeadTimeMs = 365 * 24 * 60 * 60 * 1000;

export type ScheduledServiceTimeResult =
  | { ok: true; scheduledFor: Date }
  | { ok: false; reason: "invalid_format" | "invalid_date" | "too_soon" | "too_far" };

export function parseScheduledServiceTime(text: string, now = new Date()): ScheduledServiceTimeResult {
  const match = text.match(
    /\b(?:(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/](\d{1,2})[-/](\d{4}))\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  );
  if (!match) return { ok: false, reason: "invalid_format" };

  const year = Number(match[1] ?? match[6]);
  const month = Number(match[2] ?? match[5]);
  const day = Number(match[3] ?? match[4]);
  let hour = Number(match[7]);
  const minute = Number(match[8] ?? 0);
  const meridiem = match[9]?.toLowerCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return { ok: false, reason: "invalid_date" };
    hour = hour % 12 + (meridiem === "pm" ? 12 : 0);
  }

  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, reason: "invalid_date" };
  }

  const scheduledFor = new Date(Date.UTC(year, month - 1, day, hour, minute) - indiaOffsetMs);
  const indiaTime = new Date(scheduledFor.getTime() + indiaOffsetMs);
  if (
    indiaTime.getUTCFullYear() !== year ||
    indiaTime.getUTCMonth() !== month - 1 ||
    indiaTime.getUTCDate() !== day ||
    indiaTime.getUTCHours() !== hour ||
    indiaTime.getUTCMinutes() !== minute
  ) {
    return { ok: false, reason: "invalid_date" };
  }

  if (scheduledFor.getTime() < now.getTime() + minimumLeadTimeMs) return { ok: false, reason: "too_soon" };
  if (scheduledFor.getTime() > now.getTime() + maximumLeadTimeMs) return { ok: false, reason: "too_far" };
  return { ok: true, scheduledFor };
}

export function scheduledServiceTimeFormatHelp(reason: Exclude<ScheduledServiceTimeResult, { ok: true }>["reason"]) {
  if (reason === "too_soon") return "Choose a time at least 15 minutes from now.";
  if (reason === "too_far") return "Bookings can be scheduled up to one year in advance.";
  return "Reply with the appointment date and time in DD/MM/YYYY HH:MM format, for example 20/07/2026 15:30.";
}
