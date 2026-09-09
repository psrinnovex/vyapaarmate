import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  createSubscriptionBillingIdentitySnapshot,
  readSubscriptionBillingIdentitySnapshot,
  subscriptionBillingIdentitySnapshotMatches
} from "./subscription-invoice";

const currentBusiness = {
  name: "Current Traders",
  ownerName: "Current Owner",
  address: "22 Current Road",
  city: "Bengaluru",
  state: "Karnataka",
  email: "current@example.com",
  phone: "+919999999999"
};

test("uses the immutable checkout identity for an issued subscription invoice", () => {
  const snapshot = createSubscriptionBillingIdentitySnapshot({
    name: "Original Traders",
    ownerName: "Original Owner",
    address: "10 Original Road",
    city: "Bengaluru",
    state: "Karnataka",
    email: "original@example.com",
    phone: "+918888888888"
  });

  const persistedSnapshot = JSON.parse(JSON.stringify(snapshot)) as Prisma.JsonValue;
  assert.deepEqual(readSubscriptionBillingIdentitySnapshot(persistedSnapshot, currentBusiness), {
    businessName: "Original Traders",
    ownerName: "Original Owner",
    address: "10 Original Road",
    city: "Bengaluru",
    state: "Karnataka",
    email: "original@example.com",
    phone: "+918888888888"
  });
  assert.equal(subscriptionBillingIdentitySnapshotMatches(persistedSnapshot, currentBusiness), false);
});

test("falls back to the current business identity for legacy or malformed snapshots", () => {
  const expected = {
    businessName: currentBusiness.name,
    ownerName: currentBusiness.ownerName,
    address: currentBusiness.address,
    city: currentBusiness.city,
    state: currentBusiness.state,
    email: currentBusiness.email,
    phone: currentBusiness.phone
  };

  assert.deepEqual(readSubscriptionBillingIdentitySnapshot(null, currentBusiness), expected);
  assert.deepEqual(readSubscriptionBillingIdentitySnapshot({ businessName: "Incomplete" }, currentBusiness), expected);
});

test("matches a pending checkout snapshot only while every billing identity field is unchanged", () => {
  const snapshot = JSON.parse(
    JSON.stringify(createSubscriptionBillingIdentitySnapshot(currentBusiness))
  ) as Prisma.JsonValue;

  assert.equal(subscriptionBillingIdentitySnapshotMatches(snapshot, currentBusiness), true);
  assert.equal(
    subscriptionBillingIdentitySnapshotMatches(snapshot, {
      ...currentBusiness,
      address: "23 Updated Road"
    }),
    false
  );
  assert.equal(subscriptionBillingIdentitySnapshotMatches(null, currentBusiness), false);
});
