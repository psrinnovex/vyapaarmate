import assert from "node:assert/strict";
import test from "node:test";
import { getNoShowEligibility } from "@/lib/booking-outcomes";
import { parseScheduledServiceTime } from "@/lib/scheduled-service-time";
import {
  defaultFulfillmentFlagsForBusinessType,
  fulfillmentFeeForOrder,
  fulfillmentLabelForBusinessType,
  fulfillmentModesFromFlags,
  requiresScheduledServiceTime
} from "@/lib/business-rules";

test("restaurants keep pickup and dine-in fulfillment", () => {
  assert.deepEqual(defaultFulfillmentFlagsForBusinessType("Restaurant"), {
    acceptsPickup: true,
    acceptsDineIn: true,
    acceptsServiceAtLocation: false
  });
  assert.deepEqual(
    fulfillmentModesFromFlags({
      businessType: "Restaurant",
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true
    }),
    ["PICKUP", "DINE_IN"]
  );
  assert.equal(fulfillmentLabelForBusinessType("Restaurant", "DINE_IN"), "Dine-in");
});

test("salons default to visits and filter pickup", () => {
  assert.deepEqual(defaultFulfillmentFlagsForBusinessType("Salon and Spa"), {
    acceptsPickup: false,
    acceptsDineIn: true,
    acceptsServiceAtLocation: false
  });
  assert.deepEqual(
    fulfillmentModesFromFlags({
      businessType: "Salon and Spa",
      acceptsPickup: true,
      acceptsDineIn: false,
      acceptsServiceAtLocation: false
    }),
    ["DINE_IN"]
  );
  assert.equal(fulfillmentLabelForBusinessType("Salon and Spa", "DINE_IN"), "Visit salon");
  assert.equal(requiresScheduledServiceTime("Salon and Spa"), true);
});

test("saloon spelling uses salon fulfillment", () => {
  assert.deepEqual(defaultFulfillmentFlagsForBusinessType("PSHR Saloon"), {
    acceptsPickup: false,
    acceptsDineIn: true,
    acceptsServiceAtLocation: false
  });
  assert.equal(fulfillmentLabelForBusinessType("PSHR Saloon", "DINE_IN"), "Visit salon");
});

test("grocery stores use store pickup and home delivery wording", () => {
  assert.deepEqual(
    fulfillmentModesFromFlags({
      businessType: "Grocery Store",
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true
    }),
    ["PICKUP", "SERVICE_AT_LOCATION"]
  );
  assert.equal(fulfillmentLabelForBusinessType("Grocery Store", "PICKUP"), "Store pickup");
  assert.equal(fulfillmentLabelForBusinessType("Grocery Store", "SERVICE_AT_LOCATION"), "Home delivery");
});

test("catering defaults to event service", () => {
  assert.deepEqual(defaultFulfillmentFlagsForBusinessType("Catering Service"), {
    acceptsPickup: false,
    acceptsDineIn: false,
    acceptsServiceAtLocation: true
  });
  assert.deepEqual(
    fulfillmentModesFromFlags({
      businessType: "Catering Service",
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true
    }),
    ["PICKUP", "SERVICE_AT_LOCATION"]
  );
  assert.equal(fulfillmentLabelForBusinessType("Catering Service", "SERVICE_AT_LOCATION"), "Event catering");
});

test("home services only allow customer-location fulfillment", () => {
  assert.deepEqual(defaultFulfillmentFlagsForBusinessType("Home Services"), {
    acceptsPickup: false,
    acceptsDineIn: false,
    acceptsServiceAtLocation: true
  });
  assert.deepEqual(
    fulfillmentModesFromFlags({
      businessType: "Home Services",
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: true
    }),
    ["SERVICE_AT_LOCATION"]
  );
  assert.equal(fulfillmentLabelForBusinessType("Home Services", "SERVICE_AT_LOCATION"), "At your location");
  assert.equal(requiresScheduledServiceTime("Home Services"), true);
});

test("no-shows require a confirmed active booking whose scheduled time has passed", () => {
  const now = new Date("2026-07-17T10:00:00.000Z");
  const past = new Date("2026-07-17T09:00:00.000Z");
  const future = new Date("2026-07-17T11:00:00.000Z");

  assert.equal(getNoShowEligibility({ status: "ACCEPTED", scheduledFor: past, now }).allowed, true);
  assert.deepEqual(getNoShowEligibility({ status: "ACCEPTED", scheduledFor: future, now }), {
    allowed: false,
    reason: "before_schedule"
  });
  assert.deepEqual(getNoShowEligibility({ status: "NEW", scheduledFor: past, now }), {
    allowed: false,
    reason: "invalid_status"
  });
  assert.deepEqual(getNoShowEligibility({ status: "READY", scheduledFor: past, noShowAt: past, now }), {
    allowed: false,
    reason: "already_recorded"
  });
});

test("WhatsApp appointment time parsing stores an exact future Asia/Kolkata timestamp", () => {
  const now = new Date("2026-07-17T04:30:00.000Z");
  const parsed = parseScheduledServiceTime("20/07/2026 3:30 pm, home visit", now);

  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.scheduledFor.toISOString(), "2026-07-20T10:00:00.000Z");
  assert.deepEqual(parseScheduledServiceTime("31/02/2026 10:00", now), { ok: false, reason: "invalid_date" });
  assert.deepEqual(parseScheduledServiceTime("tomorrow afternoon", now), { ok: false, reason: "invalid_format" });
});

test("configured fulfillment fee applies only to customer-location mode when available", () => {
  assert.equal(
    fulfillmentFeeForOrder({
      fee: 75,
      orderType: "DINE_IN",
      fulfillmentModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
      hasItems: true
    }),
    0
  );
  assert.equal(
    fulfillmentFeeForOrder({
      fee: 75,
      orderType: "SERVICE_AT_LOCATION",
      fulfillmentModes: ["DINE_IN", "SERVICE_AT_LOCATION"],
      hasItems: true
    }),
    75
  );
  assert.equal(
    fulfillmentFeeForOrder({
      fee: 12.345,
      orderType: "PICKUP",
      fulfillmentModes: ["PICKUP", "DINE_IN"],
      hasItems: true
    }),
    12.35
  );
});
