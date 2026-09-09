"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { appointmentDateKey, zonedAppointmentDateTimeToUtc } from "@/lib/appointment-scheduling";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { DashboardPageSkeleton } from "@/components/ui/skeleton";
import { AppointmentScheduler, type AppointmentSelection } from "@/components/order/appointment-scheduler";
import { cn, formatINR } from "@/lib/utils";
import { useDashboardLive } from "@/hooks/use-live-sync";

type AppointmentStatus = "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type AppointmentService = {
  id: string;
  name: string;
  categoryName: string;
  durationMinutes: number | null;
  bufferMinutes: number;
  price: number;
  isAvailable: boolean;
};

type AvailabilityRule = {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

type Provider = {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  color: string;
  isActive: boolean;
  acceptsAtBusiness: boolean;
  acceptsAtCustomerLocation: boolean;
  serviceIds: string[];
  availabilityRules: AvailabilityRule[];
  timeOff: Array<{ id: string; startsAt: string; endsAt: string; reason: string | null }>;
};

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: AppointmentStatus;
  source: "CUSTOMER_WEB" | "DASHBOARD" | "WHATSAPP" | "AI_ASSISTED";
  smartReason: string | null;
  cancellationReason: string | null;
  provider: Pick<Provider, "id" | "name" | "title" | "color">;
  customer: { id: string; name: string; phone: string; email: string | null };
  order: {
    id: string;
    publicToken: string;
    orderNumber: string;
    orderType: "PICKUP" | "DINE_IN" | "SERVICE_AT_LOCATION";
    status: string;
    paymentStatus: string;
    totalAmount: number;
    notes: string | null;
    items: Array<{ id: string; menuItemId: string | null; itemName: string; quantity: number }>;
  };
};

type DashboardPayload = {
  business: {
    id: string;
    name: string;
    slug: string;
    businessType: string;
    businessHours: string;
    supported: boolean;
    terminology: {
      appointmentSingular: string;
      appointmentPlural: string;
      providerSingular: string;
      providerPlural: string;
      smartPickerLabel: string;
    };
    settings: {
      enabled: boolean;
      autoConfirm: boolean;
      timezone: string;
      slotIntervalMinutes: number;
      leadTimeMinutes: number;
      maxAdvanceDays: number;
      cancellationNoticeMinutes: number;
    };
    fulfillmentModes: Array<"PICKUP" | "DINE_IN" | "SERVICE_AT_LOCATION">;
  };
  permissions: {
    canManageSettings: boolean;
    canManageProviders: boolean;
    canUpdateAppointments: boolean;
  };
  services: AppointmentService[];
  providers: Provider[];
  businessTimeOff: Array<{ id: string; startsAt: string; endsAt: string; reason: string | null }>;
  appointments: Appointment[];
  generatedAt: string;
};

type AppointmentAction = Record<string, unknown> & { action: string };
type Tab = "agenda" | "team" | "settings";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function apiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const flattened = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    return flattened.formErrors?.[0] ?? Object.values(flattened.fieldErrors ?? {}).flat()[0] ?? fallback;
  }
  return fallback;
}

function formatAppointmentDate(iso: string, timezone: string, includeYear = false) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {})
  }).format(new Date(iso));
}

function formatAppointmentTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatAppointmentRange(startsAt: string, endsAt: string, timezone: string) {
  const sameDay =
    appointmentDateKey(new Date(startsAt), timezone) === appointmentDateKey(new Date(endsAt), timezone);
  if (sameDay) {
    return `${formatAppointmentDate(startsAt, timezone, true)} · ${formatAppointmentTime(startsAt, timezone)}–${formatAppointmentTime(endsAt, timezone)}`;
  }
  return `${formatAppointmentDate(startsAt, timezone, true)} at ${formatAppointmentTime(startsAt, timezone)} – ${formatAppointmentDate(endsAt, timezone, true)} at ${formatAppointmentTime(endsAt, timezone)}`;
}

function minuteToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function timeToMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function localInputToUtc(value: string, timezone: string) {
  const [date, time] = value.split("T");
  if (!date || !time) throw new Error("Choose a valid date and time.");
  return zonedAppointmentDateTimeToUtc(date, timeToMinute(time), timezone).toISOString();
}

function statusBadge(status: AppointmentStatus) {
  if (status === "COMPLETED") return <Badge variant="emerald">Completed</Badge>;
  if (status === "CANCELLED") return <Badge variant="red">Cancelled</Badge>;
  if (status === "NO_SHOW") return <Badge variant="neutral">No-show</Badge>;
  if (status === "IN_PROGRESS") return <Badge variant="purple">In progress</Badge>;
  if (status === "CONFIRMED") return <Badge variant="blue">Confirmed</Badge>;
  return <Badge variant="amber">Needs confirmation</Badge>;
}

function AppointmentCard({
  appointment,
  payload,
  busy,
  onStatus,
  onReschedule
}: {
  appointment: Appointment;
  payload: DashboardPayload;
  busy: boolean;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onReschedule: (appointment: Appointment) => void;
}) {
  const { timezone } = payload.business.settings;
  const pastStart = new Date(appointment.startsAt) <= new Date();
  const serviceLine = appointment.order.items
    .map((item) => `${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.itemName}`)
    .join(", ");

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <div className="flex items-center gap-3 border-b border-line bg-slate-950 px-4 py-4 text-white sm:block sm:border-b-0 sm:border-r sm:px-5 sm:py-5">
          <p className="text-2xl font-bold tracking-tight">{formatAppointmentTime(appointment.startsAt, timezone)}</p>
          <p className="text-xs font-semibold text-white/65 sm:mt-1">{formatAppointmentDate(appointment.startsAt, timezone)}</p>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-bold text-ink">{appointment.customer.name}</h3>
                {statusBadge(appointment.status)}
                {appointment.source === "AI_ASSISTED" && (
                  <Badge variant="purple"><Sparkles className="size-3" /> Smart pick</Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{serviceLine}</p>
            </div>
            <Link
              href={`/order/${appointment.order.publicToken}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-bold text-ocean hover:underline"
            >
              {appointment.order.orderNumber} <ExternalLink className="size-3" />
            </Link>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <span className="flex items-center gap-2"><UserRound className="size-4 text-slate-400" />{appointment.provider.name}</span>
            <span className="flex items-center gap-2"><Clock3 className="size-4 text-slate-400" />Until {formatAppointmentTime(appointment.endsAt, timezone)}</span>
            <span className="flex items-center gap-2"><MapPin className="size-4 text-slate-400" />{appointment.order.orderType === "SERVICE_AT_LOCATION" ? "Customer location" : "At business"}</span>
            <span className="font-bold text-ink">{formatINR(appointment.order.totalAmount)} · {appointment.order.paymentStatus.toLowerCase()}</span>
          </div>

          {appointment.smartReason && (
            <p className="mt-3 rounded-lg bg-violet/5 px-3 py-2 text-xs leading-5 text-violet">
              <BrainCircuit className="mr-1 inline size-3.5" /> {appointment.smartReason}
            </p>
          )}

          {payload.permissions.canUpdateAppointments && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {appointment.status === "REQUESTED" && (
                <Button size="sm" variant="emerald" disabled={busy} onClick={() => onStatus(appointment, "CONFIRMED")}>
                  <Check className="size-4" /> Confirm
                </Button>
              )}
              {appointment.status === "CONFIRMED" && (
                <Button size="sm" disabled={busy} onClick={() => onStatus(appointment, "IN_PROGRESS")}>
                  Start service <ChevronRight className="size-4" />
                </Button>
              )}
              {appointment.status === "IN_PROGRESS" && (
                <Button size="sm" variant="emerald" disabled={busy} onClick={() => onStatus(appointment, "COMPLETED")}>
                  <Check className="size-4" /> Complete
                </Button>
              )}
              {pastStart && appointment.status !== "IN_PROGRESS" && (
                <Button size="sm" variant="neutral" disabled={busy} onClick={() => onStatus(appointment, "NO_SHOW")}>
                  Mark no-show
                </Button>
              )}
              {["REQUESTED", "CONFIRMED"].includes(appointment.status) && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onReschedule(appointment)}>
                  Reschedule
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => onStatus(appointment, "CANCELLED")}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateAppointmentForm({
  payload,
  busy,
  onSave,
  onClose
}: {
  payload: DashboardPayload;
  busy: boolean;
  onSave: (action: AppointmentAction) => Promise<boolean>;
  onClose: () => void;
}) {
  const [serviceIds, setServiceIds] = useState<string[]>(payload.services[0] ? [payload.services[0].id] : []);
  const [orderType, setOrderType] = useState<"PICKUP" | "DINE_IN" | "SERVICE_AT_LOCATION">(
    payload.business.fulfillmentModes[0] ?? "DINE_IN"
  );
  const [selection, setSelection] = useState<AppointmentSelection | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedServices = payload.services
    .filter((service) => serviceIds.includes(service.id))
    .map((service) => ({ id: service.id, name: service.name, quantity: 1 }));

  function toggleService(serviceId: string) {
    setServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]
    );
    setSelection(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!serviceIds.length) {
      setFormError("Choose at least one service.");
      return;
    }
    if (!selection) {
      setFormError("Choose an available professional, date, and time.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const saved = await onSave({
      action: "appointment.create",
      customer: {
        name: String(form.get("customerName") ?? ""),
        phone: String(form.get("customerPhone") ?? ""),
        email: String(form.get("customerEmail") ?? ""),
        address: String(form.get("customerAddress") ?? ""),
        whatsappOptIn: form.get("whatsappOptIn") === "on"
      },
      providerId: selection.providerId,
      startsAt: selection.startsAt,
      orderType,
      notes: String(form.get("notes") ?? ""),
      items: serviceIds.map((menuItemId) => ({ menuItemId, quantity: 1 }))
    });
    if (saved) onClose();
  }

  return (
    <Card className="mb-5 border-ocean/30 p-0">
      <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div><Badge variant="blue">Phone or walk-in booking</Badge><h2 className="mt-2 text-lg font-bold text-ink">Create {payload.business.terminology.appointmentSingular.toLowerCase()}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Uses the same live availability and double-booking protection as customer checkout.</p></div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close new appointment form"><X className="size-4" /></Button>
      </div>
      <form onSubmit={submit} className="grid gap-5 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-2"><Label>Customer name</Label><Input name="customerName" required minLength={2} maxLength={80} placeholder="Full name" /></label>
          <label className="grid gap-2"><Label>Mobile number</Label><Input name="customerPhone" type="tel" inputMode="tel" required placeholder="+91 98765 43210" /></label>
          <label className="grid gap-2"><Label>Email (optional)</Label><Input name="customerEmail" type="email" placeholder="customer@example.com" /></label>
        </div>

        <div>
          <Label>Services</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {payload.services.map((service) => {
              const selected = serviceIds.includes(service.id);
              return (
                <button key={service.id} type="button" aria-pressed={selected} onClick={() => toggleService(service.id)} className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", selected ? "border-ocean bg-ocean/5" : "border-line bg-white hover:bg-mist")}>
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", selected ? "border-ocean bg-ocean text-white" : "border-slate-300")}>{selected && <Check className="size-3.5" />}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink">{service.name}</span><span className="mt-1 block text-xs text-slate-500">{service.durationMinutes} min · {formatINR(service.price)}</span></span>
                </button>
              );
            })}
          </div>
        </div>

        {payload.business.fulfillmentModes.length > 1 && (
          <div><Label>Location</Label><div className="mt-2 flex flex-wrap gap-2">{payload.business.fulfillmentModes.map((mode) => <button key={mode} type="button" onClick={() => { setOrderType(mode); setSelection(null); }} className={cn("rounded-full border px-3 py-2 text-xs font-bold", orderType === mode ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-600")}>{mode === "SERVICE_AT_LOCATION" ? "Customer location" : mode === "DINE_IN" ? "At business" : "Pickup"}</button>)}</div></div>
        )}

        {orderType === "SERVICE_AT_LOCATION" && <label className="grid gap-2"><Label>Customer service address</Label><Textarea name="customerAddress" required maxLength={300} placeholder="House, street, area, landmark" /></label>}

        <AppointmentScheduler
          businessSlug={payload.business.slug}
          businessType={payload.business.businessType}
          timeZone={payload.business.settings.timezone}
          maxAdvanceDays={payload.business.settings.maxAdvanceDays}
          autoConfirm={payload.business.settings.autoConfirm}
          services={selectedServices}
          orderType={orderType}
          value={selection}
          onChange={setSelection}
          disabled={!payload.business.settings.enabled || !selectedServices.length}
        />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-2"><Label>Internal/customer note (optional)</Label><Input name="notes" maxLength={500} placeholder="Preferences, allergies, access notes…" /></label>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold"><input name="whatsappOptIn" type="checkbox" /> Customer agreed to WhatsApp updates</label>
        </div>
        {formError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</p>}
        {!payload.business.settings.enabled && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Turn on customer booking in Booking rules before creating scheduled appointments.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy || !payload.business.settings.enabled || !selection}>{busy ? "Creating…" : `Create ${payload.business.terminology.appointmentSingular.toLowerCase()}`}</Button></div>
      </form>
    </Card>
  );
}

function RescheduleAppointmentForm({
  appointment,
  payload,
  busy,
  onSave,
  onClose
}: {
  appointment: Appointment;
  payload: DashboardPayload;
  busy: boolean;
  onSave: (action: AppointmentAction) => Promise<boolean>;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<AppointmentSelection | null>(null);
  const services = appointment.order.items.flatMap((item) => {
    const service = payload.services.find((candidate) => candidate.id === item.menuItemId);
    return service ? [{ id: service.id, name: service.name, quantity: item.quantity }] : [];
  });
  const completeServiceSet = services.length === appointment.order.items.length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const saved = await onSave({
      action: "appointment.reschedule",
      appointmentId: appointment.id,
      providerId: selection.providerId,
      startsAt: selection.startsAt
    });
    if (saved) onClose();
  }

  return (
    <Card className="mb-5 border-violet/30 p-0">
      <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div><Badge variant="purple">Reschedule</Badge><h2 className="mt-2 text-lg font-bold text-ink">{appointment.customer.name} · {appointment.order.orderNumber}</h2><p className="mt-1 text-xs text-slate-500">Current time: {formatAppointmentDate(appointment.startsAt, payload.business.settings.timezone, true)} at {formatAppointmentTime(appointment.startsAt, payload.business.settings.timezone)}</p></div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close reschedule form"><X className="size-4" /></Button>
      </div>
      <form onSubmit={submit} className="p-4 sm:p-5">
        {completeServiceSet ? (
          <AppointmentScheduler
            businessSlug={payload.business.slug}
            businessType={payload.business.businessType}
            timeZone={payload.business.settings.timezone}
            maxAdvanceDays={payload.business.settings.maxAdvanceDays}
            autoConfirm={payload.business.settings.autoConfirm}
            services={services}
            orderType={appointment.order.orderType}
            value={selection}
            onChange={setSelection}
            initialDate={appointmentDateKey(new Date(appointment.startsAt), payload.business.settings.timezone)}
          />
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">An original service is no longer bookable. Cancel this appointment and create a new one with current services.</p>
        )}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Keep current time</Button><Button disabled={busy || !selection || !completeServiceSet}>{busy ? "Rescheduling…" : "Confirm new time"}</Button></div>
      </form>
    </Card>
  );
}

function AgendaPanel({
  payload,
  busyId,
  onStatus,
  onReschedule
}: {
  payload: DashboardPayload;
  busyId: string | null;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onReschedule: (appointment: Appointment) => void;
}) {
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const now = new Date(payload.generatedAt).getTime();
  const visible = payload.appointments.filter((appointment) => {
    if (filter === "all") return true;
    if (filter === "past") return new Date(appointment.endsAt).getTime() < now;
    return new Date(appointment.endsAt).getTime() >= now && !["CANCELLED", "NO_SHOW"].includes(appointment.status);
  });
  const grouped = visible.reduce<Map<string, Appointment[]>>((groups, appointment) => {
    const key = appointmentDateKey(new Date(appointment.startsAt), payload.business.settings.timezone);
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
    return groups;
  }, new Map());

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-white p-1">
          {(["upcoming", "past", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-md px-3 py-2 text-xs font-bold capitalize transition",
                filter === value ? "bg-ink text-white" : "text-slate-500 hover:text-ink"
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Times shown in {payload.business.settings.timezone}</p>
      </div>

      {visible.length === 0 ? (
        <Card className="grid min-h-72 place-items-center text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ocean/10 text-ocean"><CalendarDays className="size-7" /></span>
            <h2 className="mt-4 text-lg font-bold text-ink">No {filter} {payload.business.terminology.appointmentPlural.toLowerCase()}</h2>
            <p className="mt-2 leading-6 text-slate-500">New customer bookings appear here as soon as a slot is reserved.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {[...grouped.entries()].map(([date, appointments]) => (
            <div key={date}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-bold text-ink">{formatAppointmentDate(appointments[0].startsAt, payload.business.settings.timezone, true)}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs font-semibold text-slate-400">{appointments.length} booked</span>
              </div>
              <div className="grid gap-3">
                {appointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    payload={payload}
                    busy={busyId === appointment.id}
                    onStatus={onStatus}
                    onReschedule={onReschedule}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProviderProfileForm({
  provider,
  payload,
  busy,
  onSave,
  onClose
}: {
  provider?: Provider;
  payload: DashboardPayload;
  busy: boolean;
  onSave: (action: AppointmentAction) => Promise<boolean>;
  onClose: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await onSave({
      action: provider ? "provider.update" : "provider.create",
      ...(provider ? { providerId: provider.id } : {}),
      name: String(form.get("name") ?? ""),
      title: String(form.get("title") ?? ""),
      bio: String(form.get("bio") ?? ""),
      color: String(form.get("color") ?? "#0F766E"),
      isActive: form.get("isActive") === "on",
      acceptsAtBusiness: form.get("acceptsAtBusiness") === "on",
      acceptsAtCustomerLocation: form.get("acceptsAtCustomerLocation") === "on",
      serviceIds: form.getAll("serviceIds").map(String)
    });
    if (saved) onClose();
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2"><Label>Name</Label><Input name="name" required minLength={2} defaultValue={provider?.name} placeholder="e.g. Ananya" /></label>
        <label className="grid gap-2"><Label>Role / title</Label><Input name="title" required minLength={2} defaultValue={provider?.title ?? payload.business.terminology.providerSingular} /></label>
      </div>
      <label className="grid gap-2"><Label>Short bio</Label><Textarea name="bio" maxLength={500} defaultValue={provider?.bio ?? ""} placeholder="Specialities, experience, or customer-facing note" /></label>
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="grid gap-2"><Label>Calendar colour</Label><Input name="color" type="color" className="p-1" defaultValue={provider?.color ?? "#0F766E"} /></label>
        <div className="grid gap-2">
          <Label>Appointment locations</Label>
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"><input name="acceptsAtBusiness" type="checkbox" defaultChecked={provider?.acceptsAtBusiness ?? true} /> At business</label>
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"><input name="acceptsAtCustomerLocation" type="checkbox" defaultChecked={provider?.acceptsAtCustomerLocation ?? false} /> At customer location</label>
        </div>
      </div>
      <div>
        <Label>Services this {payload.business.terminology.providerSingular.toLowerCase()} can perform</Label>
        {payload.services.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {payload.services.map((service) => (
              <label key={service.id} className="flex items-start gap-3 rounded-lg border border-line p-3 hover:bg-mist">
                <input name="serviceIds" value={service.id} type="checkbox" className="mt-1" defaultChecked={provider?.serviceIds.includes(service.id) ?? true} />
                <span><span className="block font-bold text-ink">{service.name}</span><span className="text-xs text-slate-500">{service.durationMinutes ?? "—"} min · {service.categoryName}</span></span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Enable appointment booking on at least one catalog service first.</p>
        )}
      </div>
      <label className="flex items-center gap-3 rounded-lg bg-mist p-3"><input name="isActive" type="checkbox" defaultChecked={provider?.isActive ?? true} /><span><span className="block font-bold text-ink">Active and bookable</span><span className="text-xs text-slate-500">Inactive profiles remain in history but cannot receive new bookings.</span></span></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : provider ? "Save profile" : `Add ${payload.business.terminology.providerSingular.toLowerCase()}`}</Button></div>
    </form>
  );
}

function AvailabilityEditor({
  provider,
  timezone,
  busy,
  onSave
}: {
  provider: Provider;
  timezone: string;
  busy: boolean;
  onSave: (action: AppointmentAction) => Promise<boolean>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rules = weekdays.flatMap((_, weekday) => {
      if (form.get(`enabled-${weekday}`) !== "on") return [];
      return [{
        weekday,
        startMinute: timeToMinute(String(form.get(`start-${weekday}`) ?? "09:00")),
        endMinute: timeToMinute(String(form.get(`end-${weekday}`) ?? "18:00"))
      }];
    });
    await onSave({ action: "availability.save", providerId: provider.id, rules });
  }

  const firstRule = (weekday: number) => provider.availabilityRules.find((rule) => rule.weekday === weekday);
  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="font-bold text-ink">Weekly availability</h4><p className="text-xs text-slate-500">{timezone}. With no custom days, business hours are used.</p></div>
        <Button size="sm" disabled={busy}>Save hours</Button>
      </div>
      <div className="divide-y divide-line rounded-lg border border-line">
        {weekdays.map((day, weekday) => {
          const rule = firstRule(weekday);
          return (
            <div key={day} className="grid grid-cols-[minmax(0,1fr)_6.4rem_6.4rem] items-center gap-2 px-3 py-2">
              <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink"><input name={`enabled-${weekday}`} type="checkbox" defaultChecked={Boolean(rule)} /> <span className="truncate">{day}</span></label>
              <Input aria-label={`${day} opening time`} name={`start-${weekday}`} type="time" className="h-9 px-2" defaultValue={minuteToTime(rule?.startMinute ?? 9 * 60)} />
              <Input aria-label={`${day} closing time`} name={`end-${weekday}`} type="time" className="h-9 px-2" defaultValue={minuteToTime(rule?.endMinute ?? 18 * 60)} />
            </div>
          );
        })}
      </div>
    </form>
  );
}

function TimeOffEditor({
  provider,
  timezone,
  busy,
  onSave
}: {
  provider: Provider;
  timezone: string;
  busy: boolean;
  onSave: (action: AppointmentAction) => Promise<boolean>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const saved = await onSave({
        action: "timeoff.create",
        providerId: provider.id,
        startsAt: localInputToUtc(String(form.get("startsAt") ?? ""), timezone),
        endsAt: localInputToUtc(String(form.get("endsAt") ?? ""), timezone),
        reason: String(form.get("reason") ?? "")
      });
      if (saved) formElement.reset();
    } catch {
      // The parent mutation surface reports server and validation errors.
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={submit} className="grid gap-3 rounded-lg bg-mist p-3">
        <div><h4 className="font-bold text-ink">Block time off</h4><p className="text-xs text-slate-500">Prevents new slots during leave, breaks, or private events.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1"><span className="text-xs font-bold">Starts</span><Input name="startsAt" type="datetime-local" required /></label>
          <label className="grid gap-1"><span className="text-xs font-bold">Ends</span><Input name="endsAt" type="datetime-local" required /></label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row"><Input name="reason" maxLength={200} placeholder="Reason (optional)" /><Button className="sm:w-auto" disabled={busy}>Block time</Button></div>
      </form>
      {provider.timeOff.length > 0 && (
        <div className="grid gap-2">
          {provider.timeOff.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <div className="text-xs"><p className="font-bold text-ink">{formatAppointmentRange(item.startsAt, item.endsAt, timezone)}</p><p className="text-slate-500">{item.reason || "Unavailable"}</p></div>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Delete time off" disabled={busy} onClick={() => onSave({ action: "timeoff.delete", timeOffId: item.id })}><Trash2 className="size-4 text-red-600" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamPanel({
  payload,
  busy,
  mutate
}: {
  payload: DashboardPayload;
  busy: boolean;
  mutate: (action: AppointmentAction) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(payload.providers[0]?.id ?? null);
  const editing = payload.providers.find((provider) => provider.id === editingId);

  if (!payload.permissions.canManageProviders) {
    return <Card><h2 className="font-bold text-ink">Team schedule is view-only</h2><p className="mt-2 leading-6 text-slate-500">An owner can manage provider profiles, service assignments, weekly hours, and time off.</p></Card>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-ink">{payload.business.terminology.providerPlural}</h2><p className="text-sm text-slate-500">Assign services and control exactly when each professional can be booked.</p></div>
        <Button onClick={() => setEditingId("new")}><Plus className="size-4" /> Add {payload.business.terminology.providerSingular.toLowerCase()}</Button>
      </div>

      {editingId && (
        <Card className="border-ocean/30">
          <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold text-ink">{editing ? `Edit ${editing.name}` : `New ${payload.business.terminology.providerSingular.toLowerCase()}`}</h3><Button size="icon-sm" variant="ghost" onClick={() => setEditingId(null)}><X className="size-4" /></Button></div>
          <ProviderProfileForm provider={editing} payload={payload} busy={busy} onSave={mutate} onClose={() => setEditingId(null)} />
        </Card>
      )}

      {payload.providers.length === 0 ? (
        <Card className="grid min-h-64 place-items-center text-center"><div><UsersRound className="mx-auto size-10 text-ocean" /><h3 className="mt-3 font-bold text-ink">Add your first {payload.business.terminology.providerSingular.toLowerCase()}</h3><p className="mt-2 text-slate-500">Customers need an available professional before they can reserve a time.</p></div></Card>
      ) : payload.providers.map((provider) => {
        const expanded = expandedId === provider.id;
        return (
          <Card key={provider.id} className="p-0">
            <button type="button" className="flex w-full items-center gap-4 p-4 text-left sm:p-5" onClick={() => setExpandedId(expanded ? null : provider.id)}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: provider.color }}>{provider.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-bold text-ink">{provider.name}</span><Badge variant={provider.isActive ? "emerald" : "neutral"}>{provider.isActive ? "Active" : "Inactive"}</Badge></span><span className="mt-1 block text-xs text-slate-500">{provider.title} · {provider.serviceIds.length} service{provider.serviceIds.length === 1 ? "" : "s"}</span></span>
              <ChevronRight className={cn("size-5 text-slate-400 transition", expanded && "rotate-90")} />
            </button>
            {expanded && (
              <div className="grid gap-6 border-t border-line p-4 sm:p-5 xl:grid-cols-2">
                <div className="grid content-start gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-ink">Profile & services</p><p className="text-xs text-slate-500">{provider.acceptsAtBusiness ? "At business" : ""}{provider.acceptsAtBusiness && provider.acceptsAtCustomerLocation ? " + " : ""}{provider.acceptsAtCustomerLocation ? "Customer location" : ""}</p></div><Button size="sm" variant="secondary" onClick={() => setEditingId(provider.id)}>Edit profile</Button></div>
                  <AvailabilityEditor key={`${provider.id}-${payload.generatedAt}`} provider={provider} timezone={payload.business.settings.timezone} busy={busy} onSave={mutate} />
                </div>
                <TimeOffEditor provider={provider} timezone={payload.business.settings.timezone} busy={busy} onSave={mutate} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function SettingsPanel({ payload, busy, mutate }: { payload: DashboardPayload; busy: boolean; mutate: (action: AppointmentAction) => Promise<boolean> }) {
  const settings = payload.business.settings;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "settings.update",
      enabled: form.get("enabled") === "on",
      autoConfirm: form.get("autoConfirm") === "on",
      slotIntervalMinutes: Number(form.get("slotIntervalMinutes")),
      leadTimeMinutes: Number(form.get("leadTimeMinutes")),
      maxAdvanceDays: Number(form.get("maxAdvanceDays")),
      cancellationNoticeMinutes: Number(form.get("cancellationNoticeMinutes"))
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <div className="mb-5"><h2 className="text-lg font-bold text-ink">Online booking rules</h2><p className="mt-1 leading-6 text-slate-500">These controls define which times customers can reserve. Existing bookings are never changed when you edit a rule.</p></div>
        <form onSubmit={submit} className="grid gap-5">
          <label className="flex items-start gap-3 rounded-xl border border-line p-4"><input name="enabled" type="checkbox" className="mt-1" defaultChecked={settings.enabled} /><span><span className="block font-bold text-ink">Accept online {payload.business.terminology.appointmentPlural.toLowerCase()}</span><span className="mt-1 block text-xs leading-5 text-slate-500">Customers must select an available date, time, and {payload.business.terminology.providerSingular.toLowerCase()} during checkout.</span></span></label>
          <label className="flex items-start gap-3 rounded-xl border border-line p-4"><input name="autoConfirm" type="checkbox" className="mt-1" defaultChecked={settings.autoConfirm} /><span><span className="block font-bold text-ink">Automatically confirm available slots</span><span className="mt-1 block text-xs leading-5 text-slate-500">Turn this off if every request needs manual approval. The slot is still held to prevent double-booking.</span></span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2"><Label>Slot interval</Label><select name="slotIntervalMinutes" defaultValue={settings.slotIntervalMinutes} className="h-11 rounded-lg border border-line bg-white px-3 text-sm"><option value={5}>Every 5 minutes</option><option value={10}>Every 10 minutes</option><option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every hour</option></select></label>
            <label className="grid gap-2"><Label>Minimum booking notice</Label><select name="leadTimeMinutes" defaultValue={settings.leadTimeMinutes} className="h-11 rounded-lg border border-line bg-white px-3 text-sm"><option value={0}>No notice</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={1440}>1 day</option></select></label>
            <label className="grid gap-2"><Label>Book up to</Label><Input name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={settings.maxAdvanceDays} /><span className="text-xs text-slate-500">days in advance</span></label>
            <label className="grid gap-2"><Label>Cancellation notice</Label><Input name="cancellationNoticeMinutes" type="number" min={0} max={43200} defaultValue={settings.cancellationNoticeMinutes} /><span className="text-xs text-slate-500">minutes before the start time</span></label>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-mist p-3"><p className="text-xs text-slate-500">Timezone: <strong className="text-ink">{settings.timezone}</strong></p><Button disabled={busy || !payload.permissions.canManageSettings}>{busy ? "Saving…" : "Save booking rules"}</Button></div>
        </form>
      </Card>

      <div className="grid content-start gap-4">
        <Card className="bg-slate-950 text-white">
          <span className="grid size-11 place-items-center rounded-xl bg-violet text-white"><Sparkles className="size-5" /></span>
          <h3 className="mt-4 text-base font-bold">How Smart Picks work</h3>
          <p className="mt-2 text-sm leading-6 text-white/70">VyapaarMate ranks valid slots using earliest availability, provider workload, and customer-friendly hours. It never invents availability or overrides conflicts.</p>
        </Card>
        {payload.permissions.canManageProviders && (
          <Card>
            <h3 className="font-bold text-ink">Business closures</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Block every {payload.business.terminology.providerSingular.toLowerCase()} for holidays or full-business closures.</p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const formElement = event.currentTarget;
                const form = new FormData(formElement);
                const saved = await mutate({
                  action: "timeoff.create",
                  providerId: null,
                  startsAt: localInputToUtc(String(form.get("startsAt") ?? ""), settings.timezone),
                  endsAt: localInputToUtc(String(form.get("endsAt") ?? ""), settings.timezone),
                  reason: String(form.get("reason") ?? "")
                });
                if (saved) formElement.reset();
              }}
            >
              <label className="grid gap-1"><span className="text-xs font-bold">Starts</span><Input name="startsAt" type="datetime-local" required /></label>
              <label className="grid gap-1"><span className="text-xs font-bold">Ends</span><Input name="endsAt" type="datetime-local" required /></label>
              <Input name="reason" maxLength={200} placeholder="Holiday or reason" />
              <Button disabled={busy}>Block all schedules</Button>
            </form>
            {payload.businessTimeOff.length > 0 && (
              <div className="mt-4 grid gap-2 border-t border-line pt-4">
                {payload.businessTimeOff.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist p-3">
                    <div className="min-w-0 text-xs"><p className="truncate font-bold text-ink">{item.reason || "Business unavailable"}</p><p className="mt-1 text-slate-500">{formatAppointmentRange(item.startsAt, item.endsAt, settings.timezone)}</p></div>
                    <Button type="button" size="icon-xs" variant="ghost" disabled={busy} onClick={() => mutate({ action: "timeoff.delete", timeOffId: item.id })}><Trash2 className="size-4 text-red-600" /></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
        <Card>
          <h3 className="font-bold text-ink">Bookable services</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Duration and buffer are managed in your catalog.</p>
          <div className="mt-3 grid gap-2">
            {payload.services.slice(0, 8).map((service) => <div key={service.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist px-3 py-2"><span className="truncate text-xs font-bold text-ink">{service.name}</span><span className="shrink-0 text-xs text-slate-500">{service.durationMinutes} min</span></div>)}
            {!payload.services.length && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No services are enabled for appointment booking.</p>}
          </div>
          <ButtonLink href="/dashboard/menu" variant="secondary" className="mt-4 w-full">Manage services <ChevronRight className="size-4" /></ButtonLink>
        </Card>
      </div>
    </div>
  );
}

export function AppointmentsPage() {
  const { data: liveData } = useDashboardLive();
  const lastLiveSync = useRef(liveData.syncedAt);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("agenda");
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("/api/dashboard/appointments", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(data, "Could not load appointments."));
      setPayload(data as DashboardPayload);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not load appointments." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (liveData.syncedAt === lastLiveSync.current) return;
    lastLiveSync.current = liveData.syncedAt;
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
  }, [liveData.syncedAt, load]);

  const mutate = useCallback(async (action: AppointmentAction) => {
    setBusyId(String(action.appointmentId ?? action.providerId ?? action.timeOffId ?? action.action));
    setMessage(null);
    try {
      const response = await fetch("/api/dashboard/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(data, "Could not save this change."));
      setPayload(data as DashboardPayload);
      setMessage({ tone: "success", text: "Appointment system updated." });
      return true;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not save this change." });
      return false;
    } finally {
      setBusyId(null);
    }
  }, []);

  const summary = useMemo(() => {
    if (!payload) return { today: 0, upcoming: 0, needsConfirmation: 0 };
    const today = appointmentDateKey(new Date(), payload.business.settings.timezone);
    return payload.appointments.reduce(
      (value, appointment) => {
        const date = appointmentDateKey(new Date(appointment.startsAt), payload.business.settings.timezone);
        const active = !["CANCELLED", "NO_SHOW"].includes(appointment.status);
        if (date === today && active) value.today += 1;
        if (new Date(appointment.endsAt) >= new Date() && active) value.upcoming += 1;
        if (appointment.status === "REQUESTED") value.needsConfirmation += 1;
        return value;
      },
      { today: 0, upcoming: 0, needsConfirmation: 0 }
    );
  }, [payload]);

  async function updateStatus(appointment: Appointment, status: AppointmentStatus) {
    let cancellationReason = "";
    if (status === "CANCELLED") {
      const confirmed = window.confirm("Cancel this appointment and process the order cancellation/refund policy?");
      if (!confirmed) return;
      cancellationReason = "Cancelled by business";
    }
    if (status === "NO_SHOW" && !window.confirm("Mark this customer as a no-show? The linked order will be cancelled.")) return;
    await mutate({ action: "appointment.status", appointmentId: appointment.id, status, cancellationReason });
  }

  if (loading) return <DashboardPageSkeleton variant="cards" />;
  if (!payload) {
    return <Card className="grid min-h-80 place-items-center text-center"><div><CalendarClock className="mx-auto size-10 text-red-500" /><h1 className="mt-4 text-lg font-bold text-ink">Appointments could not be loaded</h1><p className="mt-2 text-slate-500">Your existing data is unchanged. Try again.</p><Button className="mt-4" onClick={() => load()}>Retry</Button></div></Card>;
  }

  if (!payload.business.supported) {
    return <Card className="grid min-h-80 place-items-center text-center"><div className="max-w-lg"><CalendarDays className="mx-auto size-12 text-ocean" /><h1 className="mt-4 text-xl font-bold text-ink">Appointments are not required for this category</h1><p className="mt-2 leading-6 text-slate-500">The scheduler is available for salons and spas, fitness or yoga studios, home services, tailoring, laundry pickups, and catering bookings.</p><ButtonLink href="/dashboard/settings" className="mt-5">Review business category</ButtonLink></div></Card>;
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof CalendarDays }> = [
    { id: "agenda", label: "Schedule", icon: CalendarDays },
    { id: "team", label: payload.business.terminology.providerPlural, icon: UsersRound },
    { id: "settings", label: "Booking rules", icon: Settings2 }
  ];

  return (
    <div className="pb-8">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-slate-950 px-5 py-6 text-white sm:px-7">
        <div className="absolute -right-16 -top-24 size-64 rounded-full bg-violet/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="purple"><Sparkles className="size-3" /> Smart scheduling</Badge><Badge className="border-white/10 bg-white/10 text-white">{payload.business.settings.enabled ? "Customer booking on" : "Customer booking off"}</Badge></div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{payload.business.terminology.appointmentPlural}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">One conflict-safe schedule for customers, {payload.business.terminology.providerPlural.toLowerCase()}, services, payments, and order updates.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[25rem]">
            {[{ label: "Today", value: summary.today }, { label: "Upcoming", value: summary.upcoming }, { label: "To confirm", value: summary.needsConfirmation }].map((metric) => <div key={metric.label} className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"><p className="text-xl font-bold">{metric.value}</p><p className="mt-1 text-[11px] font-semibold text-white/55">{metric.label}</p></div>)}
          </div>
        </div>
      </div>

      {message && <div role="status" className={cn("mb-4 flex items-start justify-between gap-3 rounded-lg border p-3 text-sm font-semibold", message.tone === "success" ? "border-emerald/20 bg-emerald/10 text-emerald" : "border-red-200 bg-red-50 text-red-700")}><span>{message.text}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss"><X className="size-4" /></button></div>}

      {createOpen && (
        <CreateAppointmentForm
          payload={payload}
          busy={Boolean(busyId)}
          onSave={mutate}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {rescheduleTarget && (
        <RescheduleAppointmentForm
          key={rescheduleTarget.id}
          appointment={rescheduleTarget}
          payload={payload}
          busy={Boolean(busyId)}
          onSave={mutate}
          onClose={() => setRescheduleTarget(null)}
        />
      )}

      <div className="mb-5 flex items-center justify-between gap-3 overflow-x-auto border-b border-line">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition", tab === item.id ? "border-ink text-ink" : "border-transparent text-slate-500 hover:text-ink")}><item.icon className="size-4" />{item.label}</button>)}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {payload.permissions.canUpdateAppointments && (
            <Button size="sm" onClick={() => { setRescheduleTarget(null); setCreateOpen((current) => !current); }}><Plus className="size-4" /> New booking</Button>
          )}
          <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => load(true)}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refresh</Button>
        </div>
      </div>

      {tab === "agenda" && (
        <AgendaPanel
          payload={payload}
          busyId={busyId}
          onStatus={updateStatus}
          onReschedule={(appointment) => {
            setCreateOpen(false);
            setRescheduleTarget(appointment);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
      {tab === "team" && <TeamPanel payload={payload} busy={Boolean(busyId)} mutate={mutate} />}
      {tab === "settings" && <SettingsPanel key={payload.generatedAt} payload={payload} busy={Boolean(busyId)} mutate={mutate} />}
    </div>
  );
}
