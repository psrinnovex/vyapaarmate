import { z } from "zod";
import { apiRequest } from "@/api/client";

const liveOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customer: z.string(),
  customerPhone: z.string(),
  items: z.string(),
  itemCount: z.number().int(),
  amount: z.number(),
  status: z.enum(["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"]),
  paymentStatus: z.string(),
  channel: z.string(),
  time: z.string(),
  createdAt: z.iso.datetime(),
  orderType: z.string(),
  notes: z.string().nullable(),
});

const dashboardPayloadSchema = z.object({
  business: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    businessType: z.string(),
    city: z.string(),
    isOpen: z.boolean(),
    hours: z.string(),
    logoUrl: z.string().nullable(),
  }).passthrough(),
  metrics: z.object({
    ordersToday: z.number(),
    revenueToday: z.number(),
    pendingPaymentsAmount: z.number(),
    pendingPaymentsCount: z.number(),
    repeatCustomers: z.number(),
    totalCustomers: z.number(),
    repeatRate: z.number(),
  }),
  recentOrders: z.array(liveOrderSchema),
  orders: z.array(liveOrderSchema),
  topItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number(),
    quantitySold: z.number(),
    revenue: z.number(),
  })),
}).passthrough();

const businessHomeSchema = z.object({
  scope: z.enum(["overview", "orders"]),
  payload: dashboardPayloadSchema,
});

const appointmentSchema = z.object({
  id: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timezone: z.string(),
  status: z.enum(["REQUESTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  provider: z.object({ id: z.string(), name: z.string(), title: z.string(), color: z.string() }),
  customer: z.object({ id: z.string(), name: z.string(), phone: z.string(), email: z.string().nullable() }),
  order: z.object({
    id: z.string(),
    orderNumber: z.string(),
    orderType: z.string(),
    status: z.string(),
    paymentStatus: z.string(),
    totalAmount: z.number(),
    notes: z.string().nullable(),
    items: z.array(z.object({ itemName: z.string(), quantity: z.number().int() }).passthrough()),
  }),
}).passthrough();

const appointmentDashboardSchema = z.object({
  business: z.object({
    id: z.string(),
    name: z.string(),
    supported: z.boolean(),
    settings: z.object({ enabled: z.boolean(), timezone: z.string() }).passthrough(),
  }).passthrough(),
  permissions: z.object({
    canManageSettings: z.boolean(),
    canManageProviders: z.boolean(),
    canUpdateAppointments: z.boolean(),
  }),
  appointments: z.array(appointmentSchema),
  generatedAt: z.iso.datetime(),
}).passthrough();

export function getBusinessHome() {
  return apiRequest("/api/mobile/v1/business/home").then((payload) => businessHomeSchema.parse(payload));
}

export function getBusinessOrders() {
  return apiRequest("/api/dashboard/live?scope=orders").then((payload) => dashboardPayloadSchema.parse(payload));
}

export function updateOrderStatus(orderId: string, status: z.infer<typeof liveOrderSchema>["status"]) {
  return apiRequest(`/api/dashboard/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    json: { status },
  });
}

export function getBusinessAppointments() {
  return apiRequest("/api/dashboard/appointments").then((payload) => appointmentDashboardSchema.parse(payload));
}

export function updateAppointmentStatus(
  appointmentId: string,
  status: z.infer<typeof appointmentSchema>["status"],
) {
  return apiRequest("/api/dashboard/appointments", {
    method: "PATCH",
    json: { action: "appointment.status", appointmentId, status },
  });
}

export type LiveOrder = z.infer<typeof liveOrderSchema>;
export type BusinessAppointment = z.infer<typeof appointmentSchema>;
