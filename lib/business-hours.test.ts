import assert from "node:assert/strict";
import test from "node:test";
import { getBusinessHoursSummary, isBusinessAcceptingNow, isBusinessOpenAt } from "@/lib/business-hours";

const weeklySchedule = [
  "Sun: 9:00 AM - 9:00 PM",
  "Mon: 9:00 AM - 9:00 PM",
  "Tue: 9:00 AM - 9:00 PM",
  "Wed: 9:00 AM - 9:00 PM",
  "Thu: 9:00 AM - 9:00 PM",
  "Fri: Closed",
  "Sat: 9:00 AM - 9:00 PM"
].join("; ");

test("business hours open and close by the current IST time", () => {
  assert.equal(isBusinessOpenAt(weeklySchedule, new Date("2026-06-25T04:00:00.000Z")), true);
  assert.equal(isBusinessOpenAt(weeklySchedule, new Date("2026-06-25T16:30:00.000Z")), false);
});

test("closed weekdays are treated as unavailable", () => {
  assert.equal(isBusinessOpenAt(weeklySchedule, new Date("2026-06-26T04:30:00.000Z")), false);
  assert.equal(
    getBusinessHoursSummary(weeklySchedule, false, new Date("2026-06-26T04:30:00.000Z")).primary,
    "Closed today"
  );
});

test("overnight hours stay open after midnight and close at the next-day cutoff", () => {
  const overnightSchedule = "Wed: 9:00 PM - 2:00 AM; Thu: 9:00 PM - 2:00 AM";

  assert.equal(isBusinessOpenAt(overnightSchedule, new Date("2026-06-24T20:00:00.000Z")), true);
  assert.equal(isBusinessOpenAt(overnightSchedule, new Date("2026-06-24T21:00:00.000Z")), false);
  assert.equal(isBusinessOpenAt(overnightSchedule, new Date("2026-06-25T16:00:00.000Z")), true);
});

test("manual open switch remains an override", () => {
  const now = new Date("2026-06-25T04:00:00.000Z");

  assert.equal(isBusinessAcceptingNow({ manuallyOpen: true, hours: weeklySchedule, now }), true);
  assert.equal(isBusinessAcceptingNow({ manuallyOpen: false, hours: weeklySchedule, now }), false);
  assert.equal(isBusinessAcceptingNow({ manuallyOpen: false, hours: "Open today", now }), false);
});
