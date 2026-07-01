import assert from "node:assert/strict";
import test from "node:test";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { getBusinessStaffPermissionSummary, getBusinessStaffRoleLabel } from "@/lib/business-staff-copy";
import { businessServiceTypeOptions } from "@/lib/business-service-types";

const expectedCopyByBusinessType = new Map<string, readonly [string, string, string, string]>(
  [
    ["Tiffin Center", ["Menu", "Items", "Orders", "Customers"]],
    ["Restaurant", ["Menu", "Items", "Orders", "Customers"]],
    ["Cloud Kitchen", ["Menu", "Items", "Orders", "Customers"]],
    ["Home Bakery", ["Menu", "Items", "Orders", "Customers"]],
    ["Cafe", ["Menu", "Items", "Orders", "Customers"]],
    ["Juice Shop", ["Menu", "Items", "Orders", "Customers"]],
    ["Catering Service", ["Packages", "Packages", "Bookings", "Clients"]],
    ["Sweets and Snacks", ["Menu", "Items", "Orders", "Customers"]],
    ["Grocery Store", ["Catalog", "Products", "Orders", "Customers"]],
    ["Salon and Spa", ["Services", "Services", "Appointments", "Clients"]],
    ["Laundry Service", ["Services", "Services", "Laundry Orders", "Customers"]],
    ["Tailoring and Boutique", ["Services", "Services", "Orders", "Clients"]],
    ["Home Services", ["Services", "Services", "Service Requests", "Clients"]],
    ["Pharmacy", ["Catalog", "Products", "Orders", "Customers"]],
    ["Fitness or Yoga Studio", ["Classes", "Classes", "Bookings", "Members"]]
  ] as const
);

test("all configured business types have matching operation copy", () => {
  for (const option of businessServiceTypeOptions) {
    const expected = expectedCopyByBusinessType.get(option.name);
    assert.ok(expected, `Missing copy expectation for ${option.name}`);

    const copy = getBusinessConsoleCopy(option.name);
    assert.deepEqual(
      [copy.catalogNavLabel, copy.itemPlural, copy.transactionPlural, copy.customerPlural],
      expected,
      option.name
    );
  }
});

test("saloon businesses use appointment dashboard copy", () => {
  const copy = getBusinessConsoleCopy("PSHR Saloon & Spa");

  assert.equal(copy.catalogNavLabel, "Services");
  assert.equal(copy.transactionSingular, "Appointment");
  assert.equal(copy.transactionPlural, "Appointments");
  assert.equal(copy.customerPlural, "Clients");
  assert.equal(copy.minimumValueLabel, "Minimum appointment value");
});

test("saloon staff summaries avoid order and menu wording", () => {
  const businessType = "PSHR Saloon & Spa";

  assert.equal(getBusinessStaffRoleLabel("KITCHEN_STAFF", businessType), "Salon Staff");
  assert.equal(getBusinessStaffRoleLabel("DELIVERY_STAFF", businessType), "Service Staff");
  assert.equal(
    getBusinessStaffPermissionSummary("MANAGER", businessType),
    "Appointments, services, clients, payments, reports"
  );
  assert.equal(
    getBusinessStaffPermissionSummary("KITCHEN_STAFF", businessType),
    "Appointments and service progress updates"
  );
  assert.equal(getBusinessStaffPermissionSummary("DELIVERY_STAFF", businessType), "Appointment status updates");
});

test("non-restaurant staff summaries match business workflows", () => {
  assert.equal(getBusinessStaffRoleLabel("KITCHEN_STAFF", "Catering Service"), "Catering Staff");
  assert.equal(getBusinessStaffRoleLabel("DELIVERY_STAFF", "Catering Service"), "Event Staff");
  assert.equal(
    getBusinessStaffPermissionSummary("MANAGER", "Catering Service"),
    "Bookings, packages, clients, payments, reports"
  );
  assert.equal(
    getBusinessStaffPermissionSummary("KITCHEN_STAFF", "Catering Service"),
    "Bookings and event preparation updates"
  );
  assert.equal(getBusinessStaffPermissionSummary("DELIVERY_STAFF", "Catering Service"), "Event booking status updates");

  assert.equal(
    getBusinessStaffPermissionSummary("MANAGER", "Laundry Service"),
    "Laundry Orders, services, customers, payments, reports"
  );
  assert.equal(
    getBusinessStaffPermissionSummary("KITCHEN_STAFF", "Laundry Service"),
    "Laundry Orders and laundry status updates"
  );

  assert.equal(
    getBusinessStaffPermissionSummary("MANAGER", "Home Services"),
    "Service Requests, services, clients, payments, reports"
  );
  assert.equal(
    getBusinessStaffPermissionSummary("KITCHEN_STAFF", "Home Services"),
    "Service requests and field status updates"
  );
});
