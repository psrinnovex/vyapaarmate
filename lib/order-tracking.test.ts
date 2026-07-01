import assert from "node:assert/strict";
import test from "node:test";
import { getOrderTrackingCopy, orderTrackingIndex } from "@/lib/order-tracking";

test("food businesses use preparation language", () => {
  const copy = getOrderTrackingCopy("Cloud Kitchen", "PICKUP");
  assert.equal(copy.stages[2].label, "Preparing");
  assert.equal(copy.stages[3].label, "Ready for pickup");
  assert.equal(copy.transactionLabel, "order");
});

test("salon businesses use appointment language", () => {
  const copy = getOrderTrackingCopy("Salon and Spa", "DINE_IN");
  assert.equal(copy.transactionLabel, "appointment");
  assert.equal(copy.stages[0].label, "Booking received");
  assert.equal(copy.stages[1].label, "Appointment confirmed");
  assert.equal(copy.stages[2].label, "Service preparation");
  assert.equal(copy.stages[3].label, "Ready for you");
  assert.equal(copy.stages[4].label, "Service completed");
});

test("saloon spelling uses appointment language", () => {
  const copy = getOrderTrackingCopy("PSHR Saloon", "DINE_IN");
  assert.equal(copy.transactionLabel, "appointment");
  assert.equal(copy.progressTitle, "Your appointment journey");
  assert.equal(copy.stages[1].label, "Appointment confirmed");
});

test("catering businesses use event booking language", () => {
  const copy = getOrderTrackingCopy("Catering Service", "SERVICE_AT_LOCATION");
  assert.equal(copy.transactionLabel, "booking");
  assert.equal(copy.progressTitle, "Your catering journey");
  assert.equal(copy.stages[1].label, "Event confirmed");
  assert.equal(copy.stages[3].label, "Ready for event");
});

test("laundry businesses use laundry order language", () => {
  const copy = getOrderTrackingCopy("Laundry Service", "DINE_IN");
  assert.equal(copy.transactionLabel, "order");
  assert.equal(copy.progressTitle, "Your laundry journey");
  assert.equal(copy.stages[2].label, "Processing");
});

test("home services use service request language", () => {
  const copy = getOrderTrackingCopy("Home Services", "SERVICE_AT_LOCATION");
  assert.equal(copy.transactionLabel, "service request");
  assert.equal(copy.progressTitle, "Your service journey");
  assert.equal(copy.stages[1].label, "Professional assigned");
});

test("tracking status order remains stable", () => {
  assert.equal(orderTrackingIndex("NEW"), 0);
  assert.equal(orderTrackingIndex("READY"), 3);
  assert.equal(orderTrackingIndex("CANCELLED"), -1);
});
