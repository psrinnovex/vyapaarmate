import assert from "node:assert/strict";
import test from "node:test";
import { launchMarketIncludesAndhraPradesh, launchBusinessLocationError, pilotCohortForLocation } from "./launch-policy";

test("separate Andhra Pradesh pilot accepts its locations without the Bengaluru offer", () => {
  if (!launchMarketIncludesAndhraPradesh) return;
  for (const location of [
    { city: "Tirupati", state: "Andhra Pradesh", latitude: 13.6288, longitude: 79.4192 },
    { city: "Kadapa", state: "AP", latitude: 14.4673, longitude: 78.8242 }
  ]) {
    assert.equal(launchBusinessLocationError(location, { requireCoordinates: true }), null);
    assert.equal(pilotCohortForLocation(location), "ANDHRA_PRADESH");
    assert.equal(isBengaluruOfferLocation(location), false);
  }
  assert.notEqual(launchBusinessLocationError({ city: "Tirupati", state: "AP", latitude: 12.9716, longitude: 77.5946 }, { requireCoordinates: true }), null);
  assert.notEqual(launchBusinessLocationError({ city: "Bengaluru", state: "AP" }), null);
});
import {
  canonicalLaunchCity,
  distanceFromLaunchCenterKm,
  isBengaluruOfferLocation,
  isInsideBengaluruLaunchArea,
  launchMarket,
  matchesLaunchCity,
  matchesLaunchState
} from "@/lib/launch-policy";
import { registerSchema } from "@/lib/validations";

test("Bengaluru launch policy accepts familiar city and state aliases", () => {
  for (const city of ["Bengaluru", "Bangalore", "BENGALURU CITY", "Bangalore Urban"]) {
    assert.equal(matchesLaunchCity(city), true, city);
    assert.equal(canonicalLaunchCity(city), "Bengaluru", city);
  }

  assert.equal(matchesLaunchState("Karnataka"), true);
  assert.equal(matchesLaunchState("KA"), true);
  assert.equal(matchesLaunchCity("Mysuru"), false);
  assert.equal(matchesLaunchState("Tamil Nadu"), false);
  assert.equal(canonicalLaunchCity("Mumbai"), null);
});

test("Bengaluru launch radius requires a real pin within 50 km of the city center", () => {
  assert.equal(
    distanceFromLaunchCenterKm(launchMarket.center.latitude, launchMarket.center.longitude),
    0
  );
  assert.equal(isInsideBengaluruLaunchArea(12.9352, 77.6245), true);
  assert.equal(isInsideBengaluruLaunchArea(13.3409, 77.101), false);
  assert.equal(isInsideBengaluruLaunchArea(null, null), false);
  assert.equal(isInsideBengaluruLaunchArea(120, 77.5946), false);
});

test("Bengaluru launch offer requires matching city, state, and coordinates", () => {
  assert.equal(
    isBengaluruOfferLocation({
      city: "Bangalore",
      state: "KA",
      latitude: 12.9716,
      longitude: 77.5946
    }),
    true
  );
  assert.equal(
    isBengaluruOfferLocation({
      city: "Bengaluru",
      state: "Karnataka",
      latitude: null,
      longitude: null
    }),
    false
  );
  assert.equal(
    isBengaluruOfferLocation({
      city: "Mysuru",
      state: "Karnataka",
      latitude: 12.9716,
      longitude: 77.5946
    }),
    false
  );
  assert.equal(
    isBengaluruOfferLocation({
      city: "Bengaluru",
      state: "Tamil Nadu",
      latitude: 12.9716,
      longitude: 77.5946
    }),
    false
  );
});

test("business registration accepts Bengaluru aliases and rejects other launch locations", () => {
  const registration = {
    name: "Launch Owner",
    businessName: "Launch Store",
    email: "owner@example.com",
    phone: "+919876543210",
    password: "a-secure-password",
    businessType: "Restaurant",
    city: "Bangalore",
    state: "KA",
    subscriptionPlan: "STARTER" as const,
    whatsappEnabled: true
  };

  assert.equal(registerSchema.safeParse(registration).success, true);
  assert.equal(registerSchema.safeParse({ ...registration, city: "Mysuru" }).success, false);
  assert.equal(registerSchema.safeParse({ ...registration, state: "Tamil Nadu" }).success, false);
});
