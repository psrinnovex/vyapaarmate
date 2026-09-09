"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CalendarDays, Check, Clock3, LoaderCircle, Sparkles, UserRound, UsersRound } from "lucide-react";
import {
  appointmentDateKey,
  appointmentDateKeyOffset,
  getAppointmentTerminology,
  normalizeAppointmentTimeZone,
  type AppointmentAvailabilityPayload,
  type AppointmentSlot
} from "@/lib/appointment-scheduling";
import type { ActiveFulfillmentMode } from "@/lib/business-rules";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type AppointmentSelection = {
  providerId: string;
  providerName: string;
  providerTitle: string;
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  smartScore: number;
  smartReason: string;
  recommended: boolean;
};

type AppointmentService = {
  id: string;
  name: string;
  quantity: number;
};

type AvailabilityResponse = AppointmentAvailabilityPayload & { error?: string; code?: string };

function dayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
    day: new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date)
  };
}

function appointmentDateBounds(timeZone: string, maxAdvanceDays: number) {
  const now = new Date();
  const days = Math.min(Math.max(maxAdvanceDays, 1), 365);
  return {
    min: appointmentDateKey(now, timeZone),
    max: appointmentDateKeyOffset(now, days, timeZone),
    days
  };
}

function quickDateOptions(timeZone: string, maxAdvanceDays: number, selectedDate: string) {
  const now = new Date();
  const days = Math.min(Math.max(maxAdvanceDays, 1), 13);
  const quickDates = Array.from(
    { length: days + 1 },
    (_, index) => appointmentDateKeyOffset(now, index, timeZone)
  );
  if (!quickDates.includes(selectedDate)) quickDates.push(selectedDate);
  return quickDates.sort();
}

function uniqueProviders(slots: AppointmentSlot[]) {
  const seen = new Map<string, { id: string; name: string; title: string; color: string }>();
  slots.forEach((slot) => {
    if (!seen.has(slot.providerId)) {
      seen.set(slot.providerId, {
        id: slot.providerId,
        name: slot.providerName,
        title: slot.providerTitle,
        color: slot.providerColor
      });
    }
  });
  return [...seen.values()];
}

export function AppointmentScheduler({
  businessSlug,
  businessType,
  timeZone: timeZoneValue,
  maxAdvanceDays,
  autoConfirm,
  services,
  orderType,
  value,
  onChange,
  initialDate,
  disabled = false
}: {
  businessSlug: string;
  businessType: string;
  timeZone: string;
  maxAdvanceDays: number;
  autoConfirm: boolean;
  services: AppointmentService[];
  orderType: ActiveFulfillmentMode;
  value: AppointmentSelection | null;
  onChange: (value: AppointmentSelection | null) => void;
  initialDate?: string;
  disabled?: boolean;
}) {
  const timeZone = normalizeAppointmentTimeZone(timeZoneValue);
  const terminology = getAppointmentTerminology(businessType);
  const dateBounds = useMemo(
    () => appointmentDateBounds(timeZone, maxAdvanceDays),
    [maxAdvanceDays, timeZone]
  );
  const [date, setDate] = useState(() =>
    initialDate && initialDate >= dateBounds.min && initialDate <= dateBounds.max
      ? initialDate
      : dateBounds.min
  );
  const dates = useMemo(
    () => quickDateOptions(timeZone, maxAdvanceDays, date),
    [date, maxAdvanceDays, timeZone]
  );
  const [providerFilter, setProviderFilter] = useState("any");
  const [availability, setAvailability] = useState<AppointmentAvailabilityPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceSignature = JSON.stringify(
    services
      .map((service) => ({ menuItemId: service.id, quantity: service.quantity }))
      .sort((left, right) => left.menuItemId.localeCompare(right.menuItemId))
  );
  const serviceItems = useMemo(
    () => JSON.parse(serviceSignature) as Array<{ menuItemId: string; quantity: number }>,
    [serviceSignature]
  );

  useEffect(() => {
    onChange(null);
  }, [orderType, serviceSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!serviceItems.length || disabled) {
      const resetTimer = window.setTimeout(() => {
        setAvailability(null);
        setError(null);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetch("/api/appointments/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          businessSlug,
          date,
          orderType,
          items: serviceItems
        })
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as AvailabilityResponse | null;
          if (!response.ok) throw new Error(payload?.error || "Could not load available appointment times.");
          if (!payload) throw new Error("Could not load available appointment times.");
          setAvailability(payload);
        })
        .catch((requestError) => {
          if (requestError instanceof DOMException && requestError.name === "AbortError") return;
          setAvailability(null);
          setError(requestError instanceof Error ? requestError.message : "Could not load available appointment times.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [businessSlug, date, disabled, orderType, serviceItems]);

  const providers = useMemo(() => uniqueProviders(availability?.slots ?? []), [availability]);
  const activeProviderFilter =
    providerFilter === "any" || providers.some((provider) => provider.id === providerFilter)
      ? providerFilter
      : "any";
  const visibleSlots = (availability?.slots ?? []).filter(
    (slot) => activeProviderFilter === "any" || slot.providerId === activeProviderFilter
  );
  const smartSlots = visibleSlots.filter((slot) => slot.recommended).slice(0, 3);

  function selectSlot(slot: AppointmentSlot) {
    onChange({
      providerId: slot.providerId,
      providerName: slot.providerName,
      providerTitle: slot.providerTitle,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      timeLabel: slot.timeLabel,
      smartScore: slot.smartScore,
      smartReason: slot.smartReason,
      recommended: slot.recommended
    });
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-emerald/20 bg-[linear-gradient(145deg,rgba(236,253,245,0.95),rgba(239,246,255,0.92))] shadow-sm">
      <div className="border-b border-emerald/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white shadow-sm">
              <CalendarDays className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-ink">Choose {terminology.appointmentSingular.toLowerCase()} date & time</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Live availability prevents overlapping bookings. Times use {timeZone.replace("_", " ")}.
              </p>
            </div>
          </div>
          <Badge variant={autoConfirm ? "emerald" : "amber"}>{autoConfirm ? "Instant confirmation" : "Business confirmation"}</Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold text-ink">Quick dates</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">Choose up to {dateBounds.days} days ahead.</p>
          </div>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Calendar date
            <input
              type="date"
              min={dateBounds.min}
              max={dateBounds.max}
              value={date}
              onChange={(event) => {
                const nextDate = event.target.value;
                if (!nextDate) return;
                setDate(nextDate);
                onChange(null);
              }}
              className="h-10 rounded-lg border border-white bg-white px-3 text-xs font-bold normal-case tracking-normal text-ink shadow-sm outline-none focus:border-emerald focus:ring-4 focus:ring-emerald/15"
            />
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {dates.map((dateKey, index) => {
            const label = dayLabel(dateKey);
            const active = date === dateKey;
            return (
              <button
                key={dateKey}
                type="button"
                className={cn(
                  "min-w-[68px] rounded-xl border px-3 py-2 text-center transition focus:outline-none focus:ring-4 focus:ring-emerald/15",
                  active
                    ? "border-emerald bg-emerald text-white shadow-md"
                    : "border-white bg-white/90 text-slate-600 shadow-sm hover:border-emerald/30 hover:text-ink"
                )}
                aria-pressed={active}
                onClick={() => {
                  setDate(dateKey);
                  onChange(null);
                }}
              >
                <span className="block text-[10px] font-bold uppercase tracking-wide">{index === 0 ? "Today" : label.weekday}</span>
                <span className="mt-0.5 block text-lg font-black leading-none">{label.day}</span>
                <span className="mt-1 block text-[10px] font-semibold">{label.month}</span>
              </button>
            );
          })}
        </div>

        {providers.length > 1 && (
          <div className="mt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <UsersRound className="size-3.5" /> Choose {terminology.providerSingular.toLowerCase()}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  activeProviderFilter === "any" ? "border-ink bg-ink text-white" : "border-white bg-white text-slate-600"
                )}
                onClick={() => {
                  setProviderFilter("any");
                  onChange(null);
                }}
              >
                Any available
              </button>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    activeProviderFilter === provider.id ? "border-ink bg-ink text-white" : "border-white bg-white text-slate-600"
                  )}
                  onClick={() => {
                    setProviderFilter(provider.id);
                    onChange(null);
                  }}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/80 p-5 text-sm font-semibold text-slate-600">
            <LoaderCircle className="size-4 animate-spin text-emerald" /> Checking live availability
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
        )}

        {!loading && !error && availability && visibleSlots.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/80 p-5 text-center">
            <Clock3 className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 text-sm font-bold text-ink">No open times on this date</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Choose another date or professional to continue.</p>
          </div>
        )}

        {!loading && !error && smartSlots.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-ink">
                <BrainCircuit className="size-4 text-emerald" /> {terminology.smartPickerLabel}
              </p>
              <Badge variant="emerald" className="gap-1"><Sparkles className="size-3" /> Explainable AI</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {smartSlots.map((slot) => {
                const selected = value?.providerId === slot.providerId && value.startsAt === slot.startsAt;
                return (
                  <button
                    key={`smart-${slot.providerId}-${slot.startsAt}`}
                    type="button"
                    className={cn(
                      "rounded-xl border p-3 text-left shadow-sm transition focus:outline-none focus:ring-4 focus:ring-emerald/15",
                      selected ? "border-emerald bg-emerald text-white" : "border-emerald/20 bg-white hover:-translate-y-0.5 hover:border-emerald/40"
                    )}
                    onClick={() => selectSlot(slot)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black">{slot.timeLabel}</span>
                      {selected ? <Check className="size-4" /> : <Sparkles className="size-4 text-emerald" />}
                    </div>
                    <p className={cn("mt-1 truncate text-xs font-bold", selected ? "text-white/90" : "text-ink")}>{slot.providerName}</p>
                    <p className={cn("mt-1 line-clamp-2 text-[10px] leading-4", selected ? "text-white/80" : "text-slate-500")}>{slot.smartReason}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && visibleSlots.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-extrabold text-ink">All available times</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleSlots.map((slot) => {
                const selected = value?.providerId === slot.providerId && value.startsAt === slot.startsAt;
                return (
                  <button
                    key={`${slot.providerId}-${slot.startsAt}`}
                    type="button"
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus:ring-4 focus:ring-emerald/15",
                      selected
                        ? "border-emerald bg-emerald text-white shadow-md"
                        : "border-white bg-white/90 text-ink shadow-sm hover:border-emerald/30"
                    )}
                    onClick={() => selectSlot(slot)}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-extrabold">
                      {slot.timeLabel}
                      {selected && <Check className="size-4" />}
                    </span>
                    <span className={cn("mt-1 flex items-center gap-1 truncate text-[10px] font-semibold", selected ? "text-white/85" : "text-slate-500")}>
                      <UserRound className="size-3" /> {slot.providerName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {value && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald/25 bg-white p-3 shadow-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald text-white"><Check className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-ink">{value.timeLabel} with {value.providerName}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{value.providerTitle} · {value.smartReason}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
