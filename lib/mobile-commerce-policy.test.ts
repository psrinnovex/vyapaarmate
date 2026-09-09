import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMobileExternalPayment,
  hasRegulatedMobileItem,
  isMobilePhysicalServiceType,
  isRegulatedMobileServiceType
} from "@/lib/mobile-commerce-policy";

test("known physical and off-app fulfillment is eligible for external payment classification", () => {
  assert.deepEqual(
    classifyMobileExternalPayment({
      serviceTypeSlug: "restaurant",
      fulfillmentMode: "DELIVERY",
      items: [{ category: "Meals", name: "Veg thali" }]
    }),
    { allowed: true, code: null }
  );
});

test("unknown, nullable, or potentially digital service types fail closed", () => {
  assert.equal(isMobilePhysicalServiceType("restaurant"), true);
  assert.equal(isMobilePhysicalServiceType("online-coaching"), false);
  assert.equal(isMobilePhysicalServiceType(null), false);
  for (const serviceTypeSlug of [null, "", "fitness-yoga-studio", "online-course", "new-unreviewed-type"]) {
    assert.equal(
      classifyMobileExternalPayment({
        serviceTypeSlug,
        fulfillmentMode: "SERVICE_AT_LOCATION",
        items: [{ category: "Service", name: "Session" }]
      }).allowed,
      false
    );
  }
});

test("pharmacy and controlled goods are blocked", () => {
  assert.equal(isRegulatedMobileServiceType("pharmacy"), true);
  assert.equal(hasRegulatedMobileItem([{ category: "Beverages", name: "Wine bottle" }]), true);
  assert.equal(
    classifyMobileExternalPayment({
      serviceTypeSlug: "grocery-store",
      fulfillmentMode: "DELIVERY",
      items: [{ category: "Tobacco", name: "Cigarettes" }]
    }).code,
    "MOBILE_REGULATED_GOODS_NOT_AVAILABLE"
  );
});

test("remote or unknown fulfillment cannot use mobile external payment", () => {
  assert.equal(
    classifyMobileExternalPayment({
      serviceTypeSlug: "salon-spa",
      fulfillmentMode: "REMOTE",
      items: [{ category: "Service", name: "Consultation" }]
    }).code,
    "MOBILE_EXTERNAL_PAYMENT_NOT_ALLOWED"
  );
});
