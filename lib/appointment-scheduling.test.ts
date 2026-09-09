import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentDateKey,
  appointmentWeekday,
  buildAppointmentSlots,
  businessTypeSupportsAppointments,
  getAppointmentTerminology,
  zonedAppointmentDateTimeToUtc
} from "@/lib/appointment-scheduling";

test("appointment categories include current time-based service types but not ordinary retail", () => {
  assert.equal(businessTypeSupportsAppointments("Salon and Spa"), true);
  assert.equal(businessTypeSupportsAppointments("Fitness or Yoga Studio"), true);
  assert.equal(businessTypeSupportsAppointments("Home Services"), true);
  assert.equal(businessTypeSupportsAppointments("Tailoring and Boutique"), true);
  assert.equal(businessTypeSupportsAppointments("Laundry Service"), true);
  assert.equal(businessTypeSupportsAppointments("Catering Service"), true);
  assert.equal(businessTypeSupportsAppointments("Grocery Store"), false);
  assert.equal(getAppointmentTerminology("Salon and Spa").providerSingular, "Stylist");
});

test("local appointment time converts to the correct UTC instant", () => {
  assert.equal(
    zonedAppointmentDateTimeToUtc("2026-07-28", 10 * 60 + 30, "Asia/Kolkata").toISOString(),
    "2026-07-28T05:00:00.000Z"
  );
  assert.equal(appointmentDateKey(new Date("2026-07-27T20:00:00.000Z"), "Asia/Kolkata"), "2026-07-28");
  assert.equal(appointmentWeekday("2026-07-28"), 2);
});

test("slot builder removes overlapping bookings and time off", () => {
  const slots = buildAppointmentSlots({
    date: "2026-07-28",
    timeZone: "Asia/Kolkata",
    businessHours: "9:00 AM - 1:00 PM",
    slotIntervalMinutes: 30,
    leadTimeMinutes: 0,
    maxAdvanceDays: 60,
    durationMinutes: 60,
    bufferMinutes: 15,
    now: new Date("2026-07-27T00:00:00.000Z"),
    providers: [
      {
        id: "provider-1",
        name: "Anita",
        title: "Stylist",
        color: "#0F766E",
        dailyAppointmentCount: 1,
        availabilityRules: [{ weekday: 2, startMinute: 9 * 60, endMinute: 13 * 60 }],
        busyRanges: [
          {
            startsAt: new Date("2026-07-28T04:30:00.000Z"),
            blockedUntil: new Date("2026-07-28T05:45:00.000Z")
          }
        ],
        timeOff: [
          {
            startsAt: new Date("2026-07-28T06:30:00.000Z"),
            endsAt: new Date("2026-07-28T07:30:00.000Z")
          }
        ]
      }
    ]
  });

  assert.equal(slots.some((slot) => slot.startsAt === "2026-07-28T04:30:00.000Z"), false);
  assert.equal(slots.some((slot) => slot.startsAt === "2026-07-28T06:30:00.000Z"), false);
  assert.equal(slots.every((slot) => slot.providerId === "provider-1"), true);
  assert.equal(slots.filter((slot) => slot.recommended).length <= 3, true);
});

test("business hours provide safe fallback windows when a provider has no custom schedule", () => {
  const slots = buildAppointmentSlots({
    date: "2026-07-28",
    timeZone: "Asia/Kolkata",
    businessHours: "10:00 AM - 12:00 PM",
    slotIntervalMinutes: 30,
    leadTimeMinutes: 0,
    maxAdvanceDays: 60,
    durationMinutes: 30,
    bufferMinutes: 0,
    now: new Date("2026-07-27T00:00:00.000Z"),
    providers: [
      {
        id: "provider-1",
        name: "Anita",
        title: "Stylist",
        color: "#0F766E",
        dailyAppointmentCount: 0,
        availabilityRules: [],
        busyRanges: [],
        timeOff: []
      }
    ]
  });

  assert.deepEqual(slots.map((slot) => slot.timeLabel), ["10:00 am", "10:30 am", "11:00 am", "11:30 am"]);
});
