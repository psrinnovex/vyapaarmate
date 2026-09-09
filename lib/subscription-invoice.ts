import type { Prisma } from "@prisma/client";

export type SubscriptionBillingIdentity = {
  businessName: string;
  ownerName: string;
  address: string;
  city: string;
  state: string;
  email: string;
  phone: string;
};

type BusinessIdentitySource = {
  name: string;
  ownerName: string;
  address: string;
  city: string;
  state: string;
  email: string;
  phone: string;
};

export function createSubscriptionBillingIdentitySnapshot(
  business: BusinessIdentitySource
): Prisma.InputJsonObject {
  return {
    businessName: business.name,
    ownerName: business.ownerName,
    address: business.address,
    city: business.city,
    state: business.state,
    email: business.email,
    phone: business.phone
  };
}

function stringField(value: Prisma.JsonObject, key: keyof SubscriptionBillingIdentity) {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : null;
}

export function subscriptionBillingIdentitySnapshotMatches(
  snapshot: Prisma.JsonValue | null | undefined,
  business: BusinessIdentitySource
) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;

  return (
    stringField(snapshot, "businessName") === business.name &&
    stringField(snapshot, "ownerName") === business.ownerName &&
    stringField(snapshot, "address") === business.address &&
    stringField(snapshot, "city") === business.city &&
    stringField(snapshot, "state") === business.state &&
    stringField(snapshot, "email") === business.email &&
    stringField(snapshot, "phone") === business.phone
  );
}

export function readSubscriptionBillingIdentitySnapshot(
  snapshot: Prisma.JsonValue | null | undefined,
  fallback: BusinessIdentitySource
): SubscriptionBillingIdentity {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const businessName = stringField(snapshot, "businessName");
    const ownerName = stringField(snapshot, "ownerName");
    const address = stringField(snapshot, "address");
    const city = stringField(snapshot, "city");
    const state = stringField(snapshot, "state");
    const email = stringField(snapshot, "email");
    const phone = stringField(snapshot, "phone");

    if (businessName && ownerName && address && city && state && email && phone) {
      return { businessName, ownerName, address, city, state, email, phone };
    }
  }

  return {
    businessName: fallback.name,
    ownerName: fallback.ownerName,
    address: fallback.address,
    city: fallback.city,
    state: fallback.state,
    email: fallback.email,
    phone: fallback.phone
  };
}
