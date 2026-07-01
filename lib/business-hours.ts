export const businessScheduleTimeZone = "Asia/Kolkata";

export const businessWeekDays = [
  { key: "sun", label: "Sun", fullLabel: "Sunday" },
  { key: "mon", label: "Mon", fullLabel: "Monday" },
  { key: "tue", label: "Tue", fullLabel: "Tuesday" },
  { key: "wed", label: "Wed", fullLabel: "Wednesday" },
  { key: "thu", label: "Thu", fullLabel: "Thursday" },
  { key: "fri", label: "Fri", fullLabel: "Friday" },
  { key: "sat", label: "Sat", fullLabel: "Saturday" }
] as const;

export type BusinessWeekDayKey = (typeof businessWeekDays)[number]["key"];

type BusinessHourRange = {
  opensAtMinutes: number;
  closesAtMinutes: number;
  label: string;
};

export type BusinessHourRow = {
  key: BusinessWeekDayKey;
  label: string;
  fullLabel: string;
  available: boolean;
  open: boolean;
  opensAtMinutes: number | null;
  closesAtMinutes: number | null;
  rangeLabel: string;
};

export type BusinessHoursSummary = {
  schedule: BusinessHourRow[] | null;
  primary: string;
  secondary: string | null;
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: businessScheduleTimeZone,
  weekday: "short"
});

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: businessScheduleTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function parseTimeInput(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3];

  if (minutes < 0 || minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

export function formatBusinessMinutesLabel(totalMinutes: number) {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function parseTimeRange(value: string): BusinessHourRange | null {
  const match = value.trim().match(/^(.+?)\s*(?:-|–|\bto\b)\s*(.+)$/i);
  if (!match) return null;

  const opensAtMinutes = parseTimeInput(match[1]);
  const closesAtMinutes = parseTimeInput(match[2]);
  if (opensAtMinutes === null || closesAtMinutes === null) return null;

  return {
    opensAtMinutes,
    closesAtMinutes,
    label: `${formatBusinessMinutesLabel(opensAtMinutes)} - ${formatBusinessMinutesLabel(closesAtMinutes)}`
  };
}

function createClosedSchedule(): BusinessHourRow[] {
  return businessWeekDays.map((day) => ({
    key: day.key,
    label: day.label,
    fullLabel: day.fullLabel,
    available: false,
    open: false,
    opensAtMinutes: null,
    closesAtMinutes: null,
    rangeLabel: "Not set"
  }));
}

function applyRangeToDay(day: (typeof businessWeekDays)[number], range: BusinessHourRange): BusinessHourRow {
  return {
    key: day.key,
    label: day.label,
    fullLabel: day.fullLabel,
    available: true,
    open: true,
    opensAtMinutes: range.opensAtMinutes,
    closesAtMinutes: range.closesAtMinutes,
    rangeLabel: range.label
  };
}

export function parseBusinessHours(value: string) {
  const rawValue = value.trim();
  if (!rawValue || /^open today$/i.test(rawValue)) return null;

  const sameHours = parseTimeRange(rawValue);
  if (sameHours) return businessWeekDays.map((day) => applyRangeToDay(day, sameHours));

  const schedule = createClosedSchedule();
  let parsedDayCount = 0;

  rawValue.split(";").forEach((entry) => {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) return;

    const day = businessWeekDays.find((candidate) => {
      const dayPattern = new RegExp(`^(?:${candidate.label}|${candidate.fullLabel})\\b:?\\s*`, "i");
      return dayPattern.test(trimmedEntry);
    });
    if (!day) return;

    const content = trimmedEntry.replace(new RegExp(`^(?:${day.label}|${day.fullLabel})\\b:?\\s*`, "i"), "").trim();
    const rowIndex = schedule.findIndex((row) => row.key === day.key);
    if (rowIndex === -1) return;

    parsedDayCount += 1;
    if (/^(closed|close|off|not available)$/i.test(content)) {
      schedule[rowIndex] = {
        ...schedule[rowIndex],
        available: true,
        open: false,
        rangeLabel: "Closed"
      };
      return;
    }

    const range = parseTimeRange(content);
    if (range) {
      schedule[rowIndex] = applyRangeToDay(day, range);
      return;
    }

    schedule[rowIndex] = {
      ...schedule[rowIndex],
      available: true,
      open: true,
      rangeLabel: content || "Open"
    };
  });

  return parsedDayCount > 0 ? schedule : null;
}

export function getBusinessTime(now: Date) {
  const dayLabel = weekdayFormatter.format(now).slice(0, 3).toLowerCase() as BusinessWeekDayKey;
  const dayIndex = Math.max(0, businessWeekDays.findIndex((day) => day.key === dayLabel));
  const parts = clockFormatter.formatToParts(now);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return {
    dayIndex,
    minutes: hours * 60 + minutes
  };
}

function isTimeWithinOpeningDay(row: BusinessHourRow, currentMinutes: number) {
  if (!row.open || row.opensAtMinutes === null || row.closesAtMinutes === null) return false;
  if (row.opensAtMinutes === row.closesAtMinutes) return true;

  if (row.closesAtMinutes > row.opensAtMinutes) {
    return currentMinutes >= row.opensAtMinutes && currentMinutes < row.closesAtMinutes;
  }

  return currentMinutes >= row.opensAtMinutes;
}

function isPreviousDayOvernightOpen(row: BusinessHourRow, currentMinutes: number) {
  if (!row.open || row.opensAtMinutes === null || row.closesAtMinutes === null) return false;
  if (row.opensAtMinutes === row.closesAtMinutes) return true;
  return row.closesAtMinutes <= row.opensAtMinutes && currentMinutes < row.closesAtMinutes;
}

function getActiveBusinessHourRow(schedule: BusinessHourRow[], now: Date) {
  const { dayIndex, minutes } = getBusinessTime(now);
  const today = schedule[dayIndex];
  const previousDay = schedule[(dayIndex + businessWeekDays.length - 1) % businessWeekDays.length];

  if (isTimeWithinOpeningDay(today, minutes)) return today;
  if (isPreviousDayOvernightOpen(previousDay, minutes)) return previousDay;

  return null;
}

export function isBusinessOpenAt(hours: string, now = new Date()) {
  const schedule = parseBusinessHours(hours);
  if (!schedule) return true;
  return getActiveBusinessHourRow(schedule, now) !== null;
}

export function isBusinessAcceptingNow(input: { manuallyOpen: boolean; hours: string; now?: Date }) {
  return input.manuallyOpen && isBusinessOpenAt(input.hours, input.now ?? new Date());
}

function findNextOpenLabel(schedule: BusinessHourRow[], currentDayIndex: number, currentMinutes: number) {
  for (let offset = 0; offset < businessWeekDays.length; offset += 1) {
    const rowIndex = (currentDayIndex + offset) % businessWeekDays.length;
    const row = schedule[rowIndex];
    if (!row.open || row.opensAtMinutes === null) continue;
    if (offset === 0 && currentMinutes >= row.opensAtMinutes) continue;

    const dayLabel = offset === 0 ? "today" : offset === 1 ? "tomorrow" : row.fullLabel;
    return `${dayLabel} at ${formatBusinessMinutesLabel(row.opensAtMinutes)}`;
  }

  return null;
}

export function getBusinessHoursSummary(hours: string, businessOpen: boolean, now: Date): BusinessHoursSummary {
  const schedule = parseBusinessHours(hours);
  const trimmedHours = hours.trim();

  if (!schedule) {
    return {
      schedule: null,
      primary: businessOpen ? trimmedHours || "Hours not set" : "Closed now",
      secondary: businessOpen ? null : trimmedHours || null
    };
  }

  const { dayIndex, minutes } = getBusinessTime(now);
  const today = schedule[dayIndex];
  const activeRow = getActiveBusinessHourRow(schedule, now);

  if (activeRow && activeRow.closesAtMinutes !== null) {
    return {
      schedule,
      primary: businessOpen ? `Open until ${formatBusinessMinutesLabel(activeRow.closesAtMinutes)}` : "Closed now",
      secondary: today.available ? `Today: ${today.rangeLabel}` : null
    };
  }

  if (!today.available) {
    return {
      schedule,
      primary: "Hours not set for today",
      secondary: null
    };
  }

  if (!today.open) {
    const nextOpenLabel = findNextOpenLabel(schedule, dayIndex, minutes);
    return {
      schedule,
      primary: "Closed today",
      secondary: nextOpenLabel ? `Opens ${nextOpenLabel}` : null
    };
  }

  if (today.opensAtMinutes !== null && minutes < today.opensAtMinutes) {
    return {
      schedule,
      primary: `Opens today at ${formatBusinessMinutesLabel(today.opensAtMinutes)}`,
      secondary: today.rangeLabel
    };
  }

  const nextOpenLabel = findNextOpenLabel(schedule, dayIndex, minutes);
  return {
    schedule,
    primary: "Closed now",
    secondary: nextOpenLabel ? `Opens ${nextOpenLabel}` : today.rangeLabel
  };
}
