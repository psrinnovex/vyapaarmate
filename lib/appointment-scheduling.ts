import {
  isCateringBusinessType,
  isHomeServiceBusinessType,
  isLaundryBusinessType,
  isSalonBusinessType,
  isStudioBusinessType,
  isTailoringBusinessType
} from "@/lib/business-rules";
import { businessWeekDays, parseBusinessHours } from "@/lib/business-hours";

export const defaultAppointmentTimeZone = "Asia/Kolkata";
export const activeAppointmentStatuses = ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] as const;

export type AppointmentTerminology = {
  appointmentSingular: string;
  appointmentPlural: string;
  providerSingular: string;
  providerPlural: string;
  smartPickerLabel: string;
};

export type AppointmentServiceSelection = {
  menuItemId: string;
  quantity: number;
};

export type AppointmentAvailabilityRuleInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive?: boolean;
};

export type AppointmentBusyRange = {
  startsAt: Date;
  blockedUntil: Date;
};

export type AppointmentTimeOffRange = {
  startsAt: Date;
  endsAt: Date;
};

export type AppointmentProviderAvailabilityInput = {
  id: string;
  name: string;
  title: string;
  color: string;
  dailyAppointmentCount: number;
  availabilityRules: AppointmentAvailabilityRuleInput[];
  busyRanges: AppointmentBusyRange[];
  timeOff: AppointmentTimeOffRange[];
};

export type AppointmentSlot = {
  providerId: string;
  providerName: string;
  providerTitle: string;
  providerColor: string;
  startsAt: string;
  endsAt: string;
  blockedUntil: string;
  timeLabel: string;
  durationMinutes: number;
  smartScore: number;
  smartReason: string;
  recommended: boolean;
};

export type AppointmentAvailabilityPayload = {
  date: string;
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  providerLabel: string;
  availabilitySource: "provider_schedule" | "business_hours" | "default_hours";
  slots: AppointmentSlot[];
};

export function businessTypeSupportsAppointments(businessType: string) {
  return (
    isSalonBusinessType(businessType) ||
    isStudioBusinessType(businessType) ||
    isHomeServiceBusinessType(businessType) ||
    isTailoringBusinessType(businessType) ||
    isLaundryBusinessType(businessType) ||
    isCateringBusinessType(businessType)
  );
}

export function getAppointmentTerminology(businessType: string): AppointmentTerminology {
  if (isSalonBusinessType(businessType)) {
    return {
      appointmentSingular: "Appointment",
      appointmentPlural: "Appointments",
      providerSingular: "Stylist",
      providerPlural: "Stylists",
      smartPickerLabel: "Smart stylist & time picks"
    };
  }

  if (isStudioBusinessType(businessType)) {
    return {
      appointmentSingular: "Session",
      appointmentPlural: "Sessions",
      providerSingular: "Instructor",
      providerPlural: "Instructors",
      smartPickerLabel: "Smart instructor & time picks"
    };
  }

  if (isTailoringBusinessType(businessType)) {
    return {
      appointmentSingular: "Fitting",
      appointmentPlural: "Fittings",
      providerSingular: "Tailor",
      providerPlural: "Tailors",
      smartPickerLabel: "Smart tailor & time picks"
    };
  }

  if (isLaundryBusinessType(businessType)) {
    return {
      appointmentSingular: "Pickup",
      appointmentPlural: "Pickups",
      providerSingular: "Service professional",
      providerPlural: "Service professionals",
      smartPickerLabel: "Smart pickup time picks"
    };
  }

  if (isCateringBusinessType(businessType)) {
    return {
      appointmentSingular: "Booking slot",
      appointmentPlural: "Booking slots",
      providerSingular: "Coordinator",
      providerPlural: "Coordinators",
      smartPickerLabel: "Smart coordinator & time picks"
    };
  }

  return {
    appointmentSingular: "Appointment",
    appointmentPlural: "Appointments",
    providerSingular: "Professional",
    providerPlural: "Professionals",
    smartPickerLabel: "Smart professional & time picks"
  };
}

export function normalizeAppointmentTimeZone(value: string | null | undefined) {
  const candidate = value?.trim() || defaultAppointmentTimeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return defaultAppointmentTimeZone;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second")
  };
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return representedAsUtc - date.getTime();
}

export function zonedAppointmentDateTimeToUtc(dateKey: string, minuteOfDay: number, timeZoneValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Choose a valid appointment date.");
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1440) {
    throw new Error("Choose a valid appointment time.");
  }

  const timeZone = normalizeAppointmentTimeZone(timeZoneValue);
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstGuess = new Date(localAsUtc);
  const firstOffset = timeZoneOffsetMilliseconds(firstGuess, timeZone);
  let utc = new Date(localAsUtc - firstOffset);
  const correctedOffset = timeZoneOffsetMilliseconds(utc, timeZone);
  if (correctedOffset !== firstOffset) utc = new Date(localAsUtc - correctedOffset);
  return utc;
}

export function appointmentDateKey(date: Date, timeZoneValue = defaultAppointmentTimeZone) {
  const timeZone = normalizeAppointmentTimeZone(timeZoneValue);
  const parts = zonedParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function appointmentDateKeyOffset(date: Date, offsetDays: number, timeZoneValue = defaultAppointmentTimeZone) {
  const key = appointmentDateKey(date, timeZoneValue);
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays, 12));
  return shifted.toISOString().slice(0, 10);
}

export function appointmentWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function appointmentTimeLabel(isoDate: string, timeZoneValue = defaultAppointmentTimeZone) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: normalizeAppointmentTimeZone(timeZoneValue),
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoDate));
}

function rangesOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function roundUpToInterval(value: number, interval: number) {
  return Math.ceil(value / interval) * interval;
}

function fallbackBusinessWindow(businessHours: string, weekday: number) {
  const schedule = parseBusinessHours(businessHours);
  const dayKey = businessWeekDays[weekday]?.key;
  const row = schedule?.find((candidate) => candidate.key === dayKey);
  if (row?.open && row.opensAtMinutes !== null && row.closesAtMinutes !== null && row.closesAtMinutes > row.opensAtMinutes) {
    return {
      startMinute: row.opensAtMinutes,
      endMinute: row.closesAtMinutes,
      source: "business_hours" as const
    };
  }

  if (schedule) return null;
  return { startMinute: 9 * 60, endMinute: 18 * 60, source: "default_hours" as const };
}

function smartReason(input: { waitRank: number; dailyLoad: number; timeMinute: number }) {
  if (input.waitRank === 0 && input.dailyLoad === 0) return "Earliest available time with a clear schedule.";
  if (input.dailyLoad <= 1) return "Balances availability and professional workload.";
  if (input.timeMinute >= 10 * 60 && input.timeMinute < 16 * 60) return "A practical daytime opening with confirmed capacity.";
  return "Available without overlapping another confirmed booking.";
}

export function buildAppointmentSlots(input: {
  date: string;
  timeZone: string;
  businessHours: string;
  slotIntervalMinutes: number;
  leadTimeMinutes: number;
  maxAdvanceDays: number;
  durationMinutes: number;
  bufferMinutes: number;
  providers: AppointmentProviderAvailabilityInput[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeZone = normalizeAppointmentTimeZone(input.timeZone);
  const today = appointmentDateKey(now, timeZone);
  const lastDate = appointmentDateKeyOffset(now, input.maxAdvanceDays, timeZone);
  if (input.date < today || input.date > lastDate) return [] satisfies AppointmentSlot[];

  const weekday = appointmentWeekday(input.date);
  const earliestStart = new Date(now.getTime() + Math.max(0, input.leadTimeMinutes) * 60_000);
  const interval = Math.max(5, Math.min(120, Math.round(input.slotIntervalMinutes)));
  const duration = Math.max(5, Math.round(input.durationMinutes));
  const buffer = Math.max(0, Math.round(input.bufferMinutes));
  const draftSlots: Array<Omit<AppointmentSlot, "smartScore" | "smartReason" | "recommended"> & { minute: number; dailyLoad: number }> = [];

  input.providers.forEach((provider) => {
    const explicitWindows = provider.availabilityRules
      .filter((rule) => rule.weekday === weekday && rule.isActive !== false)
      .map((rule) => ({ startMinute: rule.startMinute, endMinute: rule.endMinute }));
    const fallback = explicitWindows.length ? null : fallbackBusinessWindow(input.businessHours, weekday);
    const windows = explicitWindows.length ? explicitWindows : fallback ? [fallback] : [];

    windows.forEach((window) => {
      for (
        let minute = roundUpToInterval(window.startMinute, interval);
        minute + duration <= window.endMinute;
        minute += interval
      ) {
        const startsAt = zonedAppointmentDateTimeToUtc(input.date, minute, timeZone);
        const endsAt = new Date(startsAt.getTime() + duration * 60_000);
        const blockedUntil = new Date(endsAt.getTime() + buffer * 60_000);
        if (startsAt < earliestStart) continue;
        if (provider.busyRanges.some((range) => rangesOverlap(startsAt, blockedUntil, range.startsAt, range.blockedUntil))) continue;
        if (provider.timeOff.some((range) => rangesOverlap(startsAt, blockedUntil, range.startsAt, range.endsAt))) continue;

        draftSlots.push({
          providerId: provider.id,
          providerName: provider.name,
          providerTitle: provider.title,
          providerColor: provider.color,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          blockedUntil: blockedUntil.toISOString(),
          timeLabel: appointmentTimeLabel(startsAt.toISOString(), timeZone),
          durationMinutes: duration,
          minute,
          dailyLoad: provider.dailyAppointmentCount
        });
      }
    });
  });

  draftSlots.sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.dailyLoad - right.dailyLoad || left.providerName.localeCompare(right.providerName));
  const ranked = [...draftSlots]
    .map((slot, index) => ({
      slot,
      score: Math.max(
        1,
        Math.min(
          100,
          100 -
            Math.min(index, 20) * 2 -
            Math.min(slot.dailyLoad, 10) * 4 -
            (slot.minute >= 10 * 60 && slot.minute < 16 * 60 ? 0 : 3)
        )
      )
    }))
    .sort((left, right) => right.score - left.score || left.slot.startsAt.localeCompare(right.slot.startsAt));
  const recommendedKeys = new Set(ranked.slice(0, 3).map(({ slot }) => `${slot.providerId}:${slot.startsAt}`));
  const scoreByKey = new Map(ranked.map(({ slot, score }) => [`${slot.providerId}:${slot.startsAt}`, score]));

  return draftSlots.map(({ minute, dailyLoad, ...slot }, index) => {
    const key = `${slot.providerId}:${slot.startsAt}`;
    return {
      ...slot,
      smartScore: scoreByKey.get(key) ?? 1,
      smartReason: smartReason({ waitRank: index, dailyLoad, timeMinute: minute }),
      recommended: recommendedKeys.has(key)
    };
  });
}

export function appointmentAvailabilitySource(input: {
  providers: Array<{ availabilityRules: AppointmentAvailabilityRuleInput[] }>;
  businessHours: string;
}) {
  if (input.providers.some((provider) => provider.availabilityRules.some((rule) => rule.isActive !== false))) {
    return "provider_schedule" as const;
  }
  return parseBusinessHours(input.businessHours) ? "business_hours" as const : "default_hours" as const;
}
