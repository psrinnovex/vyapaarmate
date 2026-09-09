import type { OrderType, Prisma, PrismaClient } from "@prisma/client";
import {
  activeAppointmentStatuses,
  appointmentAvailabilitySource,
  appointmentDateKey,
  appointmentDateKeyOffset,
  buildAppointmentSlots,
  businessTypeSupportsAppointments,
  getAppointmentTerminology,
  normalizeAppointmentTimeZone,
  zonedAppointmentDateTimeToUtc,
  type AppointmentAvailabilityPayload,
  type AppointmentServiceSelection
} from "@/lib/appointment-scheduling";
import { prisma } from "@/lib/prisma";
import { getPublicBusinessBySlug } from "@/lib/public-business";

type PrismaReader = PrismaClient | Prisma.TransactionClient;

export async function lockAppointmentProviders(
  db: Prisma.TransactionClient,
  providerIds: string[]
) {
  // Appointment writes and time-off writes share this transaction lock so a
  // closure cannot race a reservation after availability has been checked.
  const uniqueProviderIds = [...new Set(providerIds)].sort();
  for (const providerId of uniqueProviderIds) {
    await db.$queryRaw<Array<{ locked: string }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${`appointment-provider:${providerId}`}, 0))::text AS locked
    `;
  }
}

export class AppointmentAvailabilityError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "APPOINTMENT_UNAVAILABLE") {
    super(message);
    this.name = "AppointmentAvailabilityError";
    this.status = status;
    this.code = code;
  }
}

type AppointmentBusinessSettings = {
  id: string;
  businessType: string;
  businessHours: string;
  appointmentBookingEnabled: boolean;
  appointmentAutoConfirm: boolean;
  appointmentTimezone: string;
  appointmentSlotInterval: number;
  appointmentLeadTimeMinutes: number;
  appointmentMaxAdvanceDays: number;
};

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 12)).toISOString().slice(0, 10);
}

function validateAppointmentBusiness(business: AppointmentBusinessSettings) {
  if (!businessTypeSupportsAppointments(business.businessType)) {
    throw new AppointmentAvailabilityError(
      "This business category does not require appointment scheduling.",
      400,
      "APPOINTMENT_NOT_REQUIRED"
    );
  }
  if (!business.appointmentBookingEnabled) {
    throw new AppointmentAvailabilityError(
      "Online appointment booking is not enabled for this business yet.",
      409,
      "APPOINTMENT_BOOKING_DISABLED"
    );
  }
}

function providerSupportsOrderType(
  provider: { acceptsAtBusiness: boolean; acceptsAtCustomerLocation: boolean },
  orderType: OrderType
) {
  return orderType === "SERVICE_AT_LOCATION" ? provider.acceptsAtCustomerLocation : provider.acceptsAtBusiness;
}

function selectedQuantityMap(items: AppointmentServiceSelection[]) {
  const quantities = new Map<string, number>();
  items.forEach((item) => {
    quantities.set(item.menuItemId, (quantities.get(item.menuItemId) ?? 0) + item.quantity);
  });
  return quantities;
}

async function loadBusiness(db: PrismaReader, businessId: string) {
  return db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      businessType: true,
      businessHours: true,
      appointmentBookingEnabled: true,
      appointmentAutoConfirm: true,
      appointmentTimezone: true,
      appointmentSlotInterval: true,
      appointmentLeadTimeMinutes: true,
      appointmentMaxAdvanceDays: true
    }
  });
}

async function loadProviderSlots(input: {
  db: PrismaReader;
  business: AppointmentBusinessSettings;
  date: string;
  orderType: OrderType;
  items: AppointmentServiceSelection[];
  providerId?: string;
  excludeAppointmentId?: string;
  now?: Date;
}) {
  const quantities = selectedQuantityMap(input.items);
  if (!quantities.size) {
    throw new AppointmentAvailabilityError("Choose at least one service before selecting a time.");
  }

  const timeZone = normalizeAppointmentTimeZone(input.business.appointmentTimezone);
  const dayStart = zonedAppointmentDateTimeToUtc(input.date, 0, timeZone);
  const dayEnd = zonedAppointmentDateTimeToUtc(nextDateKey(input.date), 0, timeZone);
  const [providers, businessTimeOff] = await Promise.all([
    input.db.appointmentProvider.findMany({
      where: {
        businessId: input.business.id,
        isActive: true,
        ...(input.providerId ? { id: input.providerId } : {})
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        title: true,
        color: true,
        acceptsAtBusiness: true,
        acceptsAtCustomerLocation: true,
        services: {
          where: { menuItemId: { in: [...quantities.keys()] } },
          select: {
            menuItemId: true,
            durationOverrideMinutes: true,
            bufferOverrideMinutes: true,
            menuItem: {
              select: {
                businessId: true,
                isAvailable: true,
                appointmentEnabled: true,
                durationMinutes: true,
                bufferMinutes: true
              }
            }
          }
        },
        availabilityRules: {
          where: { isActive: true },
          select: { weekday: true, startMinute: true, endMinute: true, isActive: true }
        },
        timeOff: {
          where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
          select: { startsAt: true, endsAt: true }
        },
        appointments: {
          where: {
            ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
            startsAt: { lt: dayEnd },
            blockedUntil: { gt: dayStart },
            status: { in: [...activeAppointmentStatuses] }
          },
          select: { startsAt: true, blockedUntil: true }
        }
      }
    }),
    input.db.appointmentTimeOff.findMany({
      where: {
        businessId: input.business.id,
        providerId: null,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart }
      },
      select: { startsAt: true, endsAt: true }
    })
  ]);

  const eligibleProviders = providers.flatMap((provider) => {
    if (!providerSupportsOrderType(provider, input.orderType)) return [];
    if (provider.services.length !== quantities.size) return [];
    if (
      provider.services.some(
        (service) =>
          service.menuItem.businessId !== input.business.id ||
          !service.menuItem.isAvailable ||
          !service.menuItem.appointmentEnabled ||
          !service.menuItem.durationMinutes
      )
    ) {
      return [];
    }

    const durationMinutes = provider.services.reduce((total, service) => {
      const quantity = quantities.get(service.menuItemId) ?? 0;
      const duration = service.durationOverrideMinutes ?? service.menuItem.durationMinutes ?? 0;
      return total + duration * quantity;
    }, 0);
    const bufferMinutes = provider.services.reduce(
      (largest, service) => Math.max(largest, service.bufferOverrideMinutes ?? service.menuItem.bufferMinutes),
      0
    );
    if (durationMinutes <= 0) return [];

    return [
      {
        provider,
        durationMinutes,
        bufferMinutes
      }
    ];
  });

  const slots = eligibleProviders.flatMap(({ provider, durationMinutes, bufferMinutes }) =>
    buildAppointmentSlots({
      date: input.date,
      timeZone,
      businessHours: input.business.businessHours,
      slotIntervalMinutes: input.business.appointmentSlotInterval,
      leadTimeMinutes: input.business.appointmentLeadTimeMinutes,
      maxAdvanceDays: input.business.appointmentMaxAdvanceDays,
      durationMinutes,
      bufferMinutes,
      now: input.now,
      providers: [
        {
          id: provider.id,
          name: provider.name,
          title: provider.title,
          color: provider.color,
          dailyAppointmentCount: provider.appointments.length,
          availabilityRules: provider.availabilityRules,
          busyRanges: provider.appointments,
          timeOff: [...provider.timeOff, ...businessTimeOff]
        }
      ]
    })
  );

  const ranked = [...slots]
    .sort((left, right) => right.smartScore - left.smartScore || left.startsAt.localeCompare(right.startsAt))
    .slice(0, 3);
  const recommended = new Set(ranked.map((slot) => `${slot.providerId}:${slot.startsAt}`));
  const mergedSlots = slots
    .map((slot) => ({ ...slot, recommended: recommended.has(`${slot.providerId}:${slot.startsAt}`) }))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || right.smartScore - left.smartScore);

  return {
    slots: mergedSlots,
    providers: eligibleProviders,
    timeZone,
    availabilitySource: appointmentAvailabilitySource({
      providers: eligibleProviders.map(({ provider }) => ({ availabilityRules: provider.availabilityRules })),
      businessHours: input.business.businessHours
    })
  };
}

export async function getPublicAppointmentAvailability(input: {
  businessSlug: string;
  date: string;
  orderType: OrderType;
  items: AppointmentServiceSelection[];
  providerId?: string;
  now?: Date;
}): Promise<AppointmentAvailabilityPayload> {
  const publicBusiness = await getPublicBusinessBySlug(input.businessSlug);
  if (!publicBusiness || publicBusiness.source !== "database") {
    throw new AppointmentAvailabilityError("This business is not accepting online appointments.", 404);
  }

  const business = await loadBusiness(prisma, publicBusiness.id);
  if (!business) throw new AppointmentAvailabilityError("Business not found.", 404);
  validateAppointmentBusiness(business);

  const availability = await loadProviderSlots({
    db: prisma,
    business,
    date: input.date,
    orderType: input.orderType,
    items: input.items,
    providerId: input.providerId,
    now: input.now
  });
  const terminology = getAppointmentTerminology(business.businessType);
  const durationMinutes = availability.slots.length
    ? Math.min(...availability.slots.map((slot) => slot.durationMinutes))
    : availability.providers[0]?.durationMinutes ?? 0;
  const bufferMinutes = availability.providers.length
    ? Math.max(...availability.providers.map((provider) => provider.bufferMinutes))
    : 0;

  return {
    date: input.date,
    timezone: availability.timeZone,
    durationMinutes,
    bufferMinutes,
    providerLabel: terminology.providerSingular,
    availabilitySource: availability.availabilitySource,
    slots: availability.slots
  };
}

export async function prepareAppointmentReservation(input: {
  db: Prisma.TransactionClient;
  businessId: string;
  orderType: OrderType;
  items: AppointmentServiceSelection[];
  providerId: string;
  startsAt: string;
  excludeAppointmentId?: string;
  now?: Date;
}) {
  await lockAppointmentProviders(input.db, [input.providerId]);
  const business = await loadBusiness(input.db, input.businessId);
  if (!business) throw new AppointmentAvailabilityError("Business not found.", 404);
  validateAppointmentBusiness(business);

  const requestedStart = new Date(input.startsAt);
  if (!Number.isFinite(requestedStart.getTime())) {
    throw new AppointmentAvailabilityError("Choose a valid appointment time.");
  }
  const timeZone = normalizeAppointmentTimeZone(business.appointmentTimezone);
  const date = appointmentDateKey(requestedStart, timeZone);
  const availability = await loadProviderSlots({
    db: input.db,
    business,
    date,
    orderType: input.orderType,
    items: input.items,
    providerId: input.providerId,
    excludeAppointmentId: input.excludeAppointmentId,
    now: input.now
  });
  const slot = availability.slots.find(
    (candidate) => candidate.providerId === input.providerId && candidate.startsAt === requestedStart.toISOString()
  );
  if (!slot) {
    throw new AppointmentAvailabilityError(
      "That time is no longer available. Choose another appointment slot.",
      409,
      "APPOINTMENT_SLOT_UNAVAILABLE"
    );
  }

  return {
    providerId: slot.providerId,
    providerName: slot.providerName,
    providerTitle: slot.providerTitle,
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
    blockedUntil: new Date(slot.blockedUntil),
    timezone: timeZone,
    status: business.appointmentAutoConfirm ? ("CONFIRMED" as const) : ("REQUESTED" as const),
    source: slot.recommended ? ("AI_ASSISTED" as const) : ("CUSTOMER_WEB" as const),
    autoConfirmed: business.appointmentAutoConfirm,
    confirmedAt: business.appointmentAutoConfirm ? new Date() : null,
    smartScore: slot.smartScore,
    smartReason: slot.smartReason
  };
}

export function appointmentBookingWindow(input: {
  now?: Date;
  timeZone?: string;
  maxAdvanceDays?: number;
}) {
  const now = input.now ?? new Date();
  const timeZone = normalizeAppointmentTimeZone(input.timeZone);
  return {
    minDate: appointmentDateKey(now, timeZone),
    maxDate: appointmentDateKeyOffset(now, input.maxAdvanceDays ?? 60, timeZone)
  };
}
