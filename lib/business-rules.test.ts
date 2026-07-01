import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultFulfillmentFlagsForBusinessType,
  fulfillmentFeeForOrder,
  fulfillmentLabelForBusinessType,
  fulfillmentModesFromFlags
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
