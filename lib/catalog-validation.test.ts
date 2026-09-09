import assert from "node:assert/strict";
import test from "node:test";
import { menuItemSchema } from "./validations";

const item = { categoryId: "test", name: "Lunch", description: "Prepared meal", price: 180, foodType: "VEG", isAvailable: true, isBestSeller: false };
test("catalog round trips allow null duration only when appointment duration is not required", () => {
  assert.equal(menuItemSchema.safeParse({ ...item, appointmentEnabled: false, durationMinutes: null }).success, true);
  assert.equal(menuItemSchema.safeParse({ ...item, appointmentEnabled: true, durationMinutes: null }).success, false);
  assert.equal(menuItemSchema.safeParse({ ...item, appointmentEnabled: true, durationMinutes: 0 }).success, false);
  assert.equal(menuItemSchema.safeParse({ ...item, appointmentEnabled: true, durationMinutes: 30 }).success, true);
});
