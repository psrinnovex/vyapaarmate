"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

const weekDays = [
  { key: "sun", label: "Sun", fullLabel: "Sunday" },
  { key: "mon", label: "Mon", fullLabel: "Monday" },
  { key: "tue", label: "Tue", fullLabel: "Tuesday" },
  { key: "wed", label: "Wed", fullLabel: "Wednesday" },
  { key: "thu", label: "Thu", fullLabel: "Thursday" },
  { key: "fri", label: "Fri", fullLabel: "Friday" },
  { key: "sat", label: "Sat", fullLabel: "Saturday" }
] as const;

type WeekDayKey = (typeof weekDays)[number]["key"];

type BusinessHourRow = {
  day: WeekDayKey;
  open: boolean;
  opensAt: string;
  closesAt: string;
};

type BusinessHoursEditorProps = {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
};

const defaultOpensAt = "09:00";
const defaultClosesAt = "21:00";

function createDefaultSchedule() {
  return weekDays.map((day) => ({
    day: day.key,
    open: true,
    opensAt: defaultOpensAt,
    closesAt: defaultClosesAt
  }));
}

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

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTimeRange(value: string) {
  const parts = value.includes(" - ")
    ? value.split(" - ")
    : value.includes(" – ")
      ? value.split(" – ")
      : value.split(/\s+to\s+/i);

  if (parts.length < 2) return null;

  const opensAt = parseTimeInput(parts[0]);
  const closesAt = parseTimeInput(parts[1]);

  if (!opensAt || !closesAt) return null;
  return { opensAt, closesAt };
}

function parseBusinessHours(value?: string | null) {
  const rawValue = value?.trim();
  const schedule = createDefaultSchedule();

  if (!rawValue || /^open today$/i.test(rawValue)) return schedule;

  const sameHours = parseTimeRange(rawValue);
  if (sameHours) {
    return schedule.map((row) => ({ ...row, ...sameHours }));
  }

  rawValue.split(";").forEach((entry) => {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) return;

    const day = weekDays.find((candidate) => {
      const dayPattern = new RegExp(`^${candidate.label}\\b:?\\s*`, "i");
      return dayPattern.test(trimmedEntry);
    });
    if (!day) return;

    const content = trimmedEntry.replace(new RegExp(`^${day.label}\\b:?\\s*`, "i"), "");
    const rowIndex = schedule.findIndex((row) => row.day === day.key);
    if (rowIndex === -1) return;

    if (/^closed$/i.test(content)) {
      schedule[rowIndex] = { ...schedule[rowIndex], open: false };
      return;
    }

    const range = parseTimeRange(content);
    if (range) {
      schedule[rowIndex] = { ...schedule[rowIndex], open: true, ...range };
    }
  });

  return schedule;
}

function formatTimeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function serializeBusinessHours(schedule: BusinessHourRow[]) {
  return schedule
    .map((row) => {
      const day = weekDays.find((candidate) => candidate.key === row.day);
      const dayLabel = day?.label ?? row.day;
      if (!row.open) return `${dayLabel}: Closed`;
      return `${dayLabel}: ${formatTimeLabel(row.opensAt)} - ${formatTimeLabel(row.closesAt)}`;
    })
    .join("; ");
}

export function BusinessHoursEditor({ name, defaultValue, required }: BusinessHoursEditorProps) {
  const [schedule, setSchedule] = useState<BusinessHourRow[]>(() => parseBusinessHours(defaultValue));
  const serializedHours = useMemo(() => serializeBusinessHours(schedule), [schedule]);

  function updateRow(day: WeekDayKey, update: Partial<BusinessHourRow>) {
    setSchedule((current) => current.map((row) => (row.day === day ? { ...row, ...update } : row)));
  }

  return (
    <div className="grid gap-2">
      <input name={name} type="hidden" value={serializedHours} required={required} />
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        {schedule.map((row, index) => {
          const day = weekDays.find((candidate) => candidate.key === row.day) ?? weekDays[index];
          return (
            <div
              key={row.day}
              className="grid gap-3 border-b border-line p-3 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:items-center"
            >
              <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-start">
                <span className="w-10 text-sm font-bold text-ink">{day.label}</span>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={row.open}
                    onChange={(event) => updateRow(row.day, { open: event.currentTarget.checked })}
                    className="size-4 rounded border-line text-ocean focus:ring-ocean"
                  />
                  Open
                </label>
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <Input
                  type="time"
                  value={row.opensAt}
                  disabled={!row.open}
                  onChange={(event) => updateRow(row.day, { opensAt: event.currentTarget.value || defaultOpensAt })}
                  aria-label={`${day.fullLabel} open time`}
                  className="h-10 disabled:bg-mist disabled:text-slate-400"
                />
                <span className="text-xs font-semibold text-slate-400">to</span>
                <Input
                  type="time"
                  value={row.closesAt}
                  disabled={!row.open}
                  onChange={(event) => updateRow(row.day, { closesAt: event.currentTarget.value || defaultClosesAt })}
                  aria-label={`${day.fullLabel} close time`}
                  className="h-10 disabled:bg-mist disabled:text-slate-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
