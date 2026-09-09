import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";

const nullableString = z.string().nullable();

export const bookingSchema = z.object({
  id: z.string(),
  publicToken: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  subtotal: z.number(),
  deliveryFee: z.number(),
  totalAmount: z.number(),
  orderType: z.string(),
  deliveryAddress: nullableString,
  notes: nullableString,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  business: z.object({
    name: z.string(),
    slug: z.string(),
    city: z.string(),
    state: z.string(),
    businessType: z.string(),
  }),
  items: z.array(z.object({ itemName: z.string(), quantity: z.number().int(), total: z.number() })),
  appointment: z
    .object({
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      timezone: z.string(),
      status: z.string(),
      provider: z.object({ name: z.string(), title: z.string() }),
    })
    .nullable(),
  payment: z.object({ provider: z.string(), status: z.string(), paidAt: nullableString }).nullable(),
});

const customerHomeSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    phone: z.string().nullable(),
    role: z.literal("CUSTOMER"),
    emailVerifiedAt: nullableString,
    phoneVerifiedAt: nullableString,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  bookings: z.array(bookingSchema),
  businessProfiles: z.array(z.unknown()),
  generatedAt: z.iso.datetime(),
});

export const businessListingSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  state: z.string(),
  address: z.string(),
  businessType: z.string(),
  logoText: z.string(),
  logoUrl: nullableString,
  open: z.boolean(),
  hours: z.string(),
  minimumOrder: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  distanceKm: z.number().nullable().optional(),
  serviceRadiusKm: z.number(),
  fulfillmentModes: z.array(z.string()),
  allowsPayOnDelivery: z.boolean(),
  onlinePaymentAvailable: z.boolean(),
  whatsappAvailable: z.boolean(),
  itemCount: z.number().int(),
  featuredItems: z.array(z.string()),
});

const menuItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  foodType: z.string(),
  imageUrl: nullableString,
  isAvailable: z.boolean(),
  isBestSeller: z.boolean(),
  appointmentEnabled: z.boolean(),
  durationMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
});

export const businessDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  ownerName: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  businessType: z.string(),
  logoText: z.string(),
  logoUrl: nullableString,
  isApproved: z.boolean(),
  open: z.boolean(),
  hours: z.string(),
  minimumOrder: z.number(),
  deliveryFee: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  serviceRadiusKm: z.number(),
  fulfillmentModes: z.array(z.enum(["PICKUP", "DINE_IN", "SERVICE_AT_LOCATION"])),
  allowsPayOnDelivery: z.boolean(),
  onlinePaymentAvailable: z.boolean(),
  whatsappAvailable: z.boolean(),
  appointmentBookingEnabled: z.boolean(),
  appointmentAutoConfirm: z.boolean(),
  appointmentTimezone: z.string(),
  appointmentMaxAdvanceDays: z.number().int(),
  orderGstRateBps: z.number().int(),
  menu: z.array(menuItemSchema),
  source: z.string(),
  isDemo: z.boolean(),
  canIndex: z.boolean(),
});

const orderResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  totalAmount: z.number(),
  paymentUrl: nullableString.optional(),
  paymentReady: z.boolean().optional(),
  paymentSetupError: nullableString.optional(),
  orderUrl: z.string(),
  invoiceUrl: z.string(),
  appointment: z.unknown().optional(),
  message: z.string(),
  idempotentReplay: z.boolean().optional(),
}).passthrough();

const availabilitySchema = z.object({
  date: z.string(),
  timezone: z.string(),
  durationMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
  providerLabel: z.string(),
  availabilitySource: z.string(),
  slots: z.array(z.object({
    providerId: z.string(),
    providerName: z.string(),
    providerTitle: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    blockedUntil: z.iso.datetime(),
    durationMinutes: z.number().int(),
    smartScore: z.number(),
    smartReason: z.string(),
    recommended: z.boolean(),
  }).passthrough()),
});

const unsupportedBusinessPattern =
  /\b(pharmacy|prescription|medicine|alcohol|wine|beer|tobacco|cigarette|controlled|crypto|loan|financial|remote class|online class|digital content)\b/iu;

export function isSupportedStoreBusinessType(businessType: string) {
  return !unsupportedBusinessPattern.test(businessType);
}

export async function getCustomerHome() {
  return customerHomeSchema.parse(await apiRequest("/api/mobile/v1/customer/home"));
}

export async function searchBusinesses(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim().slice(0, 120));
  const payload = z.object({ businesses: z.array(businessListingSchema), query: z.string() }).parse(
    await apiRequest(`/api/mobile/v1/businesses?${params.toString()}`),
  );
  return { ...payload, businesses: payload.businesses.filter((item) => isSupportedStoreBusinessType(item.businessType)) };
}

export async function getBusinessDetail(slug: string) {
  const payload = z.object({ business: businessDetailSchema }).parse(
    await apiRequest(`/api/mobile/v1/businesses/${encodeURIComponent(slug)}`),
  );
  if (!isSupportedStoreBusinessType(payload.business.businessType)) {
    throw new ApiError("This business category is not available in the mobile release.", 451, null);
  }
  return payload.business;
}

export type PlaceOrderInput = {
  businessSlug: string;
  customer: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    whatsappOptIn: boolean;
    marketingOptIn: boolean;
  };
  orderType: "PICKUP" | "DINE_IN" | "SERVICE_AT_LOCATION";
  notes?: string;
  paymentMethod: "UPI" | "PAY_ON_PICKUP_OR_DELIVERY";
  appointment?: { providerId: string; startsAt: string };
  items: { menuItemId: string; quantity: number }[];
};

export async function placeOrder(input: PlaceOrderInput, idempotencyKey: string) {
  return orderResponseSchema.parse(await apiRequest("/api/orders", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    json: input,
  }));
}

export async function getAppointmentAvailability(input: {
  businessSlug: string;
  date: string;
  orderType: PlaceOrderInput["orderType"];
  items: PlaceOrderInput["items"];
}) {
  return availabilitySchema.parse(
    await apiRequest("/api/appointments/availability", { method: "POST", json: input }),
  );
}

export type BusinessListing = z.infer<typeof businessListingSchema>;
export type BusinessDetail = z.infer<typeof businessDetailSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type AppointmentSlot = z.infer<typeof availabilitySchema>["slots"][number];
