import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma, type AppointmentStatus } from "@prisma/client";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import {
  AppointmentAvailabilityError,
  lockAppointmentProviders,
  prepareAppointmentReservation
} from "@/lib/appointment-data";
import {
  businessTypeSupportsAppointments,
  getAppointmentTerminology
} from "@/lib/appointment-scheduling";
import { fulfillmentFeeForOrder, fulfillmentModesFromFlags } from "@/lib/business-rules";
import { buildOrderCouponBreakdown } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { appointmentDashboardActionSchema } from "@/lib/validations";
import { cancelOrderPaymentForBusinessCancellation } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

const appointmentInclude = {
  provider: { select: { id: true, name: true, title: true, color: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  order: {
    select: {
      id: true,
      publicToken: true,
      orderNumber: true,
      orderType: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      notes: true,
      items: { select: { id: true, menuItemId: true, itemName: true, quantity: true } }
    }
  }
} satisfies Prisma.AppointmentInclude;

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `VM-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function serializeAppointment(
  appointment: Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>
) {
  return {
    id: appointment.id,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    blockedUntil: appointment.blockedUntil.toISOString(),
    timezone: appointment.timezone,
    status: appointment.status,
    source: appointment.source,
    autoConfirmed: appointment.autoConfirmed,
    smartReason: appointment.smartReason,
    cancellationReason: appointment.cancellationReason,
    createdAt: appointment.createdAt.toISOString(),
    provider: appointment.provider,
    customer: appointment.customer,
    order: {
      ...appointment.order,
      totalAmount: Number(appointment.order.totalAmount)
    }
  };
}

async function getAppointmentDashboardPayload(businessId: string, role: Parameters<typeof hasPermission>[0]) {
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const until = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
  const [business, services, providers, businessTimeOff, appointments] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        ownerName: true,
        slug: true,
        businessType: true,
        businessHours: true,
        appointmentBookingEnabled: true,
        appointmentAutoConfirm: true,
        appointmentTimezone: true,
        appointmentSlotInterval: true,
        appointmentLeadTimeMinutes: true,
        appointmentMaxAdvanceDays: true,
        appointmentCancelNoticeMins: true,
        acceptsPickup: true,
        acceptsDineIn: true,
        acceptsServiceAtLocation: true
      }
    }),
    prisma.menuItem.findMany({
      where: { businessId, appointmentEnabled: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        bufferMinutes: true,
        price: true,
        isAvailable: true,
        category: { select: { name: true } }
      }
    }),
    prisma.appointmentProvider.findMany({
      where: { businessId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        services: { select: { menuItemId: true } },
        availabilityRules: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
        timeOff: {
          where: { endsAt: { gte: from } },
          orderBy: { startsAt: "asc" },
          take: 30
        }
      }
    }),
    prisma.appointmentTimeOff.findMany({
      where: { businessId, providerId: null, endsAt: { gte: from } },
      orderBy: { startsAt: "asc" },
      take: 30,
      select: { id: true, startsAt: true, endsAt: true, reason: true }
    }),
    prisma.appointment.findMany({
      where: { businessId, startsAt: { gte: from, lte: until } },
      orderBy: { startsAt: "asc" },
      take: 500,
      include: appointmentInclude
    })
  ]);

  if (!business) return null;
  const supported = businessTypeSupportsAppointments(business.businessType);
  const terminology = getAppointmentTerminology(business.businessType);

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      businessType: business.businessType,
      businessHours: business.businessHours,
      supported,
      terminology,
      settings: {
        enabled: business.appointmentBookingEnabled,
        autoConfirm: business.appointmentAutoConfirm,
        timezone: business.appointmentTimezone,
        slotIntervalMinutes: business.appointmentSlotInterval,
        leadTimeMinutes: business.appointmentLeadTimeMinutes,
        maxAdvanceDays: business.appointmentMaxAdvanceDays,
        cancellationNoticeMinutes: business.appointmentCancelNoticeMins
      },
      fulfillmentModes: fulfillmentModesFromFlags({
        businessType: business.businessType,
        acceptsPickup: business.acceptsPickup,
        acceptsDineIn: business.acceptsDineIn,
        acceptsServiceAtLocation: business.acceptsServiceAtLocation
      })
    },
    permissions: {
      canManageSettings: hasPermission(role, "business:settings:write"),
      canManageProviders: hasPermission(role, "business:appointments:manage"),
      canUpdateAppointments: hasPermission(role, "business:orders:update")
    },
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      categoryName: service.category.name,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      price: Number(service.price),
      isAvailable: service.isAvailable
    })),
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      title: provider.title,
      bio: provider.bio,
      color: provider.color,
      isActive: provider.isActive,
      acceptsAtBusiness: provider.acceptsAtBusiness,
      acceptsAtCustomerLocation: provider.acceptsAtCustomerLocation,
      serviceIds: provider.services.map((service) => service.menuItemId),
      availabilityRules: provider.availabilityRules.map((rule) => ({
        id: rule.id,
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute
      })),
      timeOff: provider.timeOff.map((item) => ({
        id: item.id,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
        reason: item.reason
      }))
    })),
    businessTimeOff: businessTimeOff.map((item) => ({
      id: item.id,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      reason: item.reason
    })),
    appointments: appointments.map(serializeAppointment),
    generatedAt: new Date().toISOString()
  };
}

async function validServiceIds(businessId: string, serviceIds: string[]) {
  const uniqueIds = [...new Set(serviceIds)];
  if (!uniqueIds.length) return [];
  const services = await prisma.menuItem.findMany({
    where: { businessId, id: { in: uniqueIds }, appointmentEnabled: true },
    select: { id: true }
  });
  if (services.length !== uniqueIds.length) return null;
  return uniqueIds;
}

function rulesDoNotOverlap(rules: Array<{ weekday: number; startMinute: number; endMinute: number }>) {
  const byDay = new Map<number, Array<{ startMinute: number; endMinute: number }>>();
  for (const rule of rules) {
    const existing = byDay.get(rule.weekday) ?? [];
    existing.push(rule);
    byDay.set(rule.weekday, existing);
  }
  return [...byDay.values()].every((dayRules) => {
    const sorted = [...dayRules].sort((left, right) => left.startMinute - right.startMinute);
    return sorted.every((rule, index) => index === 0 || rule.startMinute >= sorted[index - 1].endMinute);
  });
}

function permissionForAction(action: string) {
  if (action === "settings.update") return "business:settings:write";
  if (action.startsWith("provider.") || action.startsWith("availability.") || action.startsWith("timeoff.")) {
    return "business:appointments:manage";
  }
  return "business:orders:update";
}

export async function GET() {
  const auth = await requireBusinessSession("business:orders:read");
  if (auth.response) return auth.response;
  const payload = await getAppointmentDashboardPayload(auth.session.businessId, auth.session.role);
  if (!payload) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireBusinessSession();
  if (auth.response) return auth.response;
  const { session } = auth;

  const parsed = appointmentDashboardActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!hasPermission(session.role, permissionForAction(parsed.data.action))) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: {
      id: true,
      ownerName: true,
      name: true,
      businessType: true,
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true
    }
  });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!businessTypeSupportsAppointments(business.businessType)) {
    return NextResponse.json(
      { error: "Appointment scheduling is not available for this business category." },
      { status: 409 }
    );
  }

  let entity = "Business";
  let entityId = business.id;
  let auditAction = "APPOINTMENT_SETTINGS_UPDATED";
  let auditMetadata: Prisma.InputJsonObject = { action: parsed.data.action };
  let appointmentOrderIdForNotification: string | null = null;

  if (parsed.data.action === "settings.update") {
    const settings = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: business.id },
        data: {
          appointmentBookingEnabled: settings.enabled,
          appointmentAutoConfirm: settings.autoConfirm,
          appointmentSlotInterval: settings.slotIntervalMinutes,
          appointmentLeadTimeMinutes: settings.leadTimeMinutes,
          appointmentMaxAdvanceDays: settings.maxAdvanceDays,
          appointmentCancelNoticeMins: settings.cancellationNoticeMinutes
        }
      });

      if (settings.enabled) {
        const providerCount = await tx.appointmentProvider.count({ where: { businessId: business.id } });
        if (providerCount === 0) {
          const serviceIds = await tx.menuItem.findMany({
            where: { businessId: business.id, appointmentEnabled: true },
            select: { id: true }
          });
          await tx.appointmentProvider.create({
            data: {
              businessId: business.id,
              name: business.ownerName || business.name,
              title: getAppointmentTerminology(business.businessType).providerSingular,
              acceptsAtBusiness:
                business.acceptsPickup || business.acceptsDineIn || !business.acceptsServiceAtLocation,
              acceptsAtCustomerLocation: business.acceptsServiceAtLocation,
              services: { create: serviceIds.map((service) => ({ menuItemId: service.id })) }
            }
          });
        }
      }
    });
    auditMetadata = {
      action: parsed.data.action,
      enabled: parsed.data.enabled,
      autoConfirm: parsed.data.autoConfirm,
      slotIntervalMinutes: parsed.data.slotIntervalMinutes,
      leadTimeMinutes: parsed.data.leadTimeMinutes,
      maxAdvanceDays: parsed.data.maxAdvanceDays,
      cancellationNoticeMinutes: parsed.data.cancellationNoticeMinutes
    };
  } else if (parsed.data.action === "provider.create") {
    const serviceIds = await validServiceIds(business.id, parsed.data.serviceIds);
    if (!serviceIds) return NextResponse.json({ error: "One or more services are invalid." }, { status: 400 });
    const lastProvider = await prisma.appointmentProvider.findFirst({
      where: { businessId: business.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    const provider = await prisma.appointmentProvider.create({
      data: {
        businessId: business.id,
        name: parsed.data.name,
        title: parsed.data.title,
        bio: parsed.data.bio,
        color: parsed.data.color,
        isActive: parsed.data.isActive,
        acceptsAtBusiness: parsed.data.acceptsAtBusiness,
        acceptsAtCustomerLocation: parsed.data.acceptsAtCustomerLocation,
        sortOrder: (lastProvider?.sortOrder ?? -1) + 1,
        services: { create: serviceIds.map((menuItemId) => ({ menuItemId })) }
      }
    });
    entity = "AppointmentProvider";
    entityId = provider.id;
    auditAction = "APPOINTMENT_PROVIDER_CREATED";
    auditMetadata = { action: parsed.data.action, name: provider.name, serviceCount: serviceIds.length };
  } else if (parsed.data.action === "provider.update") {
    const providerUpdate = parsed.data;
    const [provider, serviceIds] = await Promise.all([
      prisma.appointmentProvider.findFirst({ where: { id: parsed.data.providerId, businessId: business.id } }),
      validServiceIds(business.id, parsed.data.serviceIds)
    ]);
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    if (!serviceIds) return NextResponse.json({ error: "One or more services are invalid." }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.appointmentProvider.update({
        where: { id: provider.id },
        data: {
          name: providerUpdate.name,
          title: providerUpdate.title,
          bio: providerUpdate.bio,
          color: providerUpdate.color,
          isActive: providerUpdate.isActive,
          acceptsAtBusiness: providerUpdate.acceptsAtBusiness,
          acceptsAtCustomerLocation: providerUpdate.acceptsAtCustomerLocation
        }
      });
      await tx.appointmentProviderService.deleteMany({ where: { providerId: provider.id } });
      if (serviceIds.length) {
        await tx.appointmentProviderService.createMany({
          data: serviceIds.map((menuItemId) => ({ providerId: provider.id, menuItemId }))
        });
      }
    });
    entity = "AppointmentProvider";
    entityId = provider.id;
    auditAction = "APPOINTMENT_PROVIDER_UPDATED";
    auditMetadata = { action: parsed.data.action, name: parsed.data.name, serviceCount: serviceIds.length };
  } else if (parsed.data.action === "availability.save") {
    const availability = parsed.data;
    const provider = await prisma.appointmentProvider.findFirst({
      where: { id: parsed.data.providerId, businessId: business.id },
      select: { id: true, name: true }
    });
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    if (!rulesDoNotOverlap(parsed.data.rules)) {
      return NextResponse.json({ error: "Availability periods on the same day cannot overlap." }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.appointmentAvailabilityRule.deleteMany({ where: { providerId: provider.id } });
      if (availability.rules.length) {
        await tx.appointmentAvailabilityRule.createMany({
          data: availability.rules.map((rule) => ({
            businessId: business.id,
            providerId: provider.id,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute
          }))
        });
      }
    });
    entity = "AppointmentProvider";
    entityId = provider.id;
    auditAction = "APPOINTMENT_AVAILABILITY_UPDATED";
    auditMetadata = { action: parsed.data.action, providerName: provider.name, ruleCount: parsed.data.rules.length };
  } else if (parsed.data.action === "timeoff.create") {
    const timeOffInput = parsed.data;
    const timeOffResult = await prisma.$transaction(async (tx) => {
      const providers = await tx.appointmentProvider.findMany({
        where: {
          businessId: business.id,
          ...(timeOffInput.providerId ? { id: timeOffInput.providerId } : {})
        },
        orderBy: { id: "asc" },
        select: { id: true }
      });
      if (timeOffInput.providerId && providers.length === 0) return { kind: "provider_missing" as const };

      await lockAppointmentProviders(tx, providers.map((provider) => provider.id));
      const existingAppointment = await tx.appointment.findFirst({
        where: {
          businessId: business.id,
          ...(timeOffInput.providerId ? { providerId: timeOffInput.providerId } : {}),
          status: { in: ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] },
          startsAt: { lt: new Date(timeOffInput.endsAt) },
          blockedUntil: { gt: new Date(timeOffInput.startsAt) }
        },
        select: { id: true }
      });
      if (existingAppointment) return { kind: "appointment_overlap" as const };

      const timeOff = await tx.appointmentTimeOff.create({
        data: {
          businessId: business.id,
          providerId: timeOffInput.providerId,
          startsAt: new Date(timeOffInput.startsAt),
          endsAt: new Date(timeOffInput.endsAt),
          reason: timeOffInput.reason
        }
      });
      return { kind: "created" as const, timeOff };
    }, { maxWait: 10_000, timeout: 15_000 });

    if (timeOffResult.kind === "provider_missing") {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    if (timeOffResult.kind === "appointment_overlap") {
      return NextResponse.json(
        { error: "This time off overlaps an existing appointment. Reschedule or cancel that booking first." },
        { status: 409 }
      );
    }
    entity = "AppointmentTimeOff";
    entityId = timeOffResult.timeOff.id;
    auditAction = "APPOINTMENT_TIME_OFF_CREATED";
    auditMetadata = {
      action: parsed.data.action,
      providerId: timeOffInput.providerId ?? "all",
      startsAt: timeOffInput.startsAt,
      endsAt: timeOffInput.endsAt
    };
  } else if (parsed.data.action === "timeoff.delete") {
    const timeOff = await prisma.appointmentTimeOff.findFirst({
      where: { id: parsed.data.timeOffId, businessId: business.id },
      select: { id: true, providerId: true }
    });
    if (!timeOff) return NextResponse.json({ error: "Time off entry not found" }, { status: 404 });
    await prisma.appointmentTimeOff.delete({ where: { id: timeOff.id } });
    entity = "AppointmentTimeOff";
    entityId = timeOff.id;
    auditAction = "APPOINTMENT_TIME_OFF_DELETED";
    auditMetadata = { action: parsed.data.action, providerId: timeOff.providerId ?? "all" };
  } else if (parsed.data.action === "appointment.reschedule") {
    const rescheduleInput = parsed.data;
    const appointment = await prisma.appointment.findFirst({
      where: { id: rescheduleInput.appointmentId, businessId: business.id },
      include: {
        order: {
          select: {
            id: true,
            orderType: true,
            items: { select: { menuItemId: true, quantity: true } }
          }
        }
      }
    });
    if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (!["REQUESTED", "CONFIRMED"].includes(appointment.status)) {
      return NextResponse.json({ error: "Only requested or confirmed appointments can be rescheduled." }, { status: 409 });
    }
    const appointmentItems = appointment.order.items.flatMap((item) =>
      item.menuItemId ? [{ menuItemId: item.menuItemId, quantity: item.quantity }] : []
    );
    if (!appointmentItems.length || appointmentItems.length !== appointment.order.items.length) {
      return NextResponse.json({ error: "One or more original services are no longer available to reschedule." }, { status: 409 });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const reservation = await prepareAppointmentReservation({
          db: tx,
          businessId: business.id,
          orderType: appointment.order.orderType,
          items: appointmentItems,
          providerId: rescheduleInput.providerId,
          startsAt: rescheduleInput.startsAt,
          excludeAppointmentId: appointment.id
        });
        const status = appointment.status === "CONFIRMED" ? "CONFIRMED" : reservation.status;
        const changed = await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            providerId: reservation.providerId,
            startsAt: reservation.startsAt,
            endsAt: reservation.endsAt,
            blockedUntil: reservation.blockedUntil,
            timezone: reservation.timezone,
            status,
            source: "DASHBOARD",
            autoConfirmed: reservation.autoConfirmed,
            confirmedAt: status === "CONFIRMED" ? appointment.confirmedAt ?? new Date() : null,
            reminderSentAt: null,
            smartScore: reservation.smartScore,
            smartReason: reservation.smartReason
          },
          select: { id: true, startsAt: true }
        });
        if (status === "CONFIRMED") {
          await tx.order.updateMany({
            where: { id: appointment.orderId, status: "NEW" },
            data: { status: "ACCEPTED" }
          });
        }
        return changed;
      }, { maxWait: 10_000, timeout: 15_000 });

      entity = "Appointment";
      entityId = updated.id;
      auditAction = "APPOINTMENT_RESCHEDULED";
      auditMetadata = {
        action: rescheduleInput.action,
        orderId: appointment.orderId,
        previousStartsAt: appointment.startsAt.toISOString(),
        startsAt: updated.startsAt.toISOString(),
        previousProviderId: appointment.providerId,
        providerId: rescheduleInput.providerId
      };
      appointmentOrderIdForNotification = appointment.orderId;
    } catch (error) {
      if (error instanceof AppointmentAvailabilityError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") ||
        (error instanceof Error && (error.message.includes("Appointment_provider_time_no_overlap") || error.message.includes("23P01")))
      ) {
        return NextResponse.json({ error: "That time was just booked. Choose another available slot." }, { status: 409 });
      }
      throw error;
    }
  } else if (parsed.data.action === "appointment.status") {
    const appointment = await prisma.appointment.findFirst({
      where: { id: parsed.data.appointmentId, businessId: business.id },
      include: { order: { select: { id: true, status: true } } }
    });
    if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status)) {
      if (appointment.status !== parsed.data.status) {
        return NextResponse.json({ error: "Completed, cancelled, or no-show appointments cannot be reopened." }, { status: 409 });
      }
    } else {
      const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
        REQUESTED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
        CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
        IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
        COMPLETED: [],
        CANCELLED: [],
        NO_SHOW: []
      };
      if (appointment.status !== parsed.data.status && !allowed[appointment.status].includes(parsed.data.status)) {
        return NextResponse.json({ error: "Use the next valid appointment action." }, { status: 409 });
      }
      if (parsed.data.status === "NO_SHOW" && appointment.startsAt > new Date()) {
        return NextResponse.json({ error: "A future appointment cannot be marked as no-show." }, { status: 409 });
      }

      if (parsed.data.status === "CANCELLED" || parsed.data.status === "NO_SHOW") {
        try {
          await cancelOrderPaymentForBusinessCancellation({
            businessId: business.id,
            orderId: appointment.orderId,
            cancelledByUserId: session.id
          });
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Could not cancel and settle this booking." },
            { status: 502 }
          );
        }
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            status: parsed.data.status,
            cancelledAt: new Date(),
            cancellationReason:
              parsed.data.cancellationReason ||
              (parsed.data.status === "NO_SHOW" ? "Customer did not attend" : "Cancelled by business")
          }
        });
      } else {
        const orderStatus =
          parsed.data.status === "CONFIRMED"
            ? "ACCEPTED"
            : parsed.data.status === "IN_PROGRESS"
              ? "PREPARING"
              : parsed.data.status === "COMPLETED"
                ? "DELIVERED"
                : appointment.order.status;
        await prisma.$transaction([
          prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              status: parsed.data.status,
              ...(parsed.data.status === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
              ...(parsed.data.status === "COMPLETED" ? { completedAt: new Date() } : {})
            }
          }),
          prisma.order.update({ where: { id: appointment.orderId }, data: { status: orderStatus } })
        ]);
      }
    }
    entity = "Appointment";
    entityId = appointment.id;
    auditAction = "APPOINTMENT_STATUS_UPDATED";
    auditMetadata = {
      action: parsed.data.action,
      previousStatus: appointment.status,
      status: parsed.data.status,
      orderId: appointment.orderId
    };
    appointmentOrderIdForNotification = appointment.orderId;
  } else {
    const createInput = parsed.data;
    const bookingBusiness = await prisma.business.findUnique({
      where: { id: business.id },
      select: {
        id: true,
        deliveryFee: true,
        acceptsPickup: true,
        acceptsDineIn: true,
        acceptsServiceAtLocation: true,
        businessType: true
      }
    });
    if (!bookingBusiness) return NextResponse.json({ error: "Business not found" }, { status: 404 });
    const fulfillmentModes = fulfillmentModesFromFlags(bookingBusiness);
    if (!fulfillmentModes.includes(createInput.orderType)) {
      return NextResponse.json({ error: "This appointment location is not enabled for the business." }, { status: 400 });
    }

    const quantityByService = new Map<string, number>();
    createInput.items.forEach((item) => {
      quantityByService.set(item.menuItemId, (quantityByService.get(item.menuItemId) ?? 0) + item.quantity);
    });
    const services = await prisma.menuItem.findMany({
      where: {
        businessId: business.id,
        id: { in: [...quantityByService.keys()] },
        isAvailable: true,
        appointmentEnabled: true,
        durationMinutes: { not: null }
      },
      select: { id: true, name: true, price: true }
    });
    if (services.length !== quantityByService.size) {
      return NextResponse.json({ error: "One or more appointment services are unavailable." }, { status: 400 });
    }
    const items = services.map((service) => {
      const quantity = quantityByService.get(service.id) ?? 1;
      const price = Number(service.price);
      return {
        menuItemId: service.id,
        itemName: service.name,
        quantity,
        price,
        total: price * quantity
      };
    });
    const subtotal = items.reduce((total, item) => total + item.total, 0);
    const serviceFee = fulfillmentFeeForOrder({
      fee: Number(bookingBusiness.deliveryFee),
      orderType: createInput.orderType,
      fulfillmentModes,
      hasItems: true
    });
    const billing = buildOrderCouponBreakdown({ subtotal, serviceFee });
    const orderNumber = createOrderNumber();
    const invoiceNumber = `INV-${business.id.slice(-6).toUpperCase()}-${orderNumber}`;
    const placedAt = new Date();

    try {
      const created = await prisma.$transaction(async (tx) => {
        const reservation = await prepareAppointmentReservation({
          db: tx,
          businessId: business.id,
          orderType: createInput.orderType,
          items: createInput.items,
          providerId: createInput.providerId,
          startsAt: createInput.startsAt,
          now: placedAt
        });
        const customer = await tx.customer.upsert({
          where: { businessId_phone: { businessId: business.id, phone: createInput.customer.phone } },
          create: {
            businessId: business.id,
            name: createInput.customer.name,
            phone: createInput.customer.phone,
            email: createInput.customer.email,
            address: createInput.customer.address,
            whatsappOptIn: createInput.customer.whatsappOptIn,
            marketingOptIn: false,
            totalOrders: 1,
            totalSpent: billing.total,
            lastOrderAt: placedAt
          },
          update: {
            name: createInput.customer.name,
            email: createInput.customer.email,
            address: createInput.customer.address,
            whatsappOptIn: createInput.customer.whatsappOptIn,
            totalOrders: { increment: 1 },
            totalSpent: { increment: billing.total },
            lastOrderAt: placedAt
          },
          select: { id: true }
        });
        const order = await tx.order.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            orderNumber,
            invoiceNumber,
            invoiceIssuedAt: placedAt,
            status: reservation.status === "CONFIRMED" ? "ACCEPTED" : "NEW",
            paymentStatus: "PENDING",
            subtotal: billing.subtotal,
            deliveryFee: billing.serviceFee,
            discountAmount: 0,
            taxableAmount: billing.taxableAmount,
            gstRateBps: billing.gstRateBps,
            gstAmount: billing.gstAmount,
            totalAmount: billing.total,
            orderType: createInput.orderType,
            deliveryAddress: createInput.customer.address,
            notes: createInput.notes,
            items: { create: items },
            payment: {
              create: {
                businessId: business.id,
                provider: "CASH",
                amount: billing.total,
                status: "PENDING"
              }
            }
          },
          select: { id: true, customerId: true }
        });
        const appointment = await tx.appointment.create({
          data: {
            businessId: business.id,
            orderId: order.id,
            customerId: customer.id,
            providerId: reservation.providerId,
            startsAt: reservation.startsAt,
            endsAt: reservation.endsAt,
            blockedUntil: reservation.blockedUntil,
            timezone: reservation.timezone,
            status: reservation.status,
            source: "DASHBOARD",
            autoConfirmed: reservation.autoConfirmed,
            confirmedAt: reservation.confirmedAt,
            smartScore: reservation.smartScore,
            smartReason: reservation.smartReason
          },
          select: { id: true }
        });
        return { orderId: order.id, appointmentId: appointment.id };
      }, { maxWait: 10_000, timeout: 15_000 });

      entity = "Appointment";
      entityId = created.appointmentId;
      auditAction = "APPOINTMENT_CREATED_BY_BUSINESS";
      auditMetadata = {
        action: createInput.action,
        orderId: created.orderId,
        orderNumber,
        providerId: createInput.providerId,
        startsAt: createInput.startsAt,
        totalAmount: billing.total
      };
      appointmentOrderIdForNotification = created.orderId;
    } catch (error) {
      if (error instanceof AppointmentAvailabilityError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") ||
        (error instanceof Error && (error.message.includes("Appointment_provider_time_no_overlap") || error.message.includes("23P01")))
      ) {
        return NextResponse.json({ error: "That time was just booked. Choose another available slot." }, { status: 409 });
      }
      throw error;
    }
  }

  await writeAuditLog({
    userId: session.id,
    businessId: business.id,
    action: auditAction,
    entity,
    entityId,
    metadata: auditMetadata
  });
  if (appointmentOrderIdForNotification) {
    await sendOrderWhatsappUpdate({
      businessId: business.id,
      orderId: appointmentOrderIdForNotification
    });
  }

  const payload = await getAppointmentDashboardPayload(business.id, session.role);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
