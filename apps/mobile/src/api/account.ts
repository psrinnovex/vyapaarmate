import * as Crypto from "expo-crypto";
import { z } from "zod";
import { accountDeletionSchema, mobileUserSchema, type MobileRole } from "@/auth/contracts";
import { apiRequest, publicApiRequest } from "@/api/client";

const deletionEnvelopeSchema = z.object({ accountDeletion: accountDeletionSchema });

const meResponseSchema = z.object({
  user: mobileUserSchema,
  session: z.object({
    id: z.string(),
    platform: z.string(),
    deviceName: z.string().nullable(),
    appVersion: z.string().nullable(),
    absoluteExpiresAt: z.iso.datetime(),
    idleExpiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  }),
  accountDeletion: accountDeletionSchema.nullable(),
});

export function getAccountSession() {
  return apiRequest("/api/mobile/v1/auth/me").then((payload) => meResponseSchema.parse(payload));
}

export function getCustomerDataExport() {
  return apiRequest("/api/user/data-export");
}

export async function revokeAllSessions(currentPassword: string) {
  return z.object({ revoked: z.literal(true), sessionCount: z.number().int() }).parse(
    await apiRequest("/api/mobile/v1/auth/revoke-all", {
      method: "POST",
      json: { current_password: currentPassword },
    }),
  );
}

export async function deleteCurrentAccount(input: {
  role: MobileRole;
  currentPassword: string;
  reason?: string;
}) {
  if (input.role === "OWNER") {
    return deletionEnvelopeSchema.parse(
      await apiRequest("/api/dashboard/account/deletion-request", {
        method: "POST",
        headers: { "Idempotency-Key": `native-${Crypto.randomUUID()}` },
        json: {
          currentPassword: input.currentPassword,
          confirmation: "DELETE MY BUSINESS ACCOUNT",
          reason: input.reason?.trim() || undefined,
        },
      }),
    );
  }

  if (input.role === "CUSTOMER") {
    const payload = await apiRequest("/api/user/delete", {
      method: "DELETE",
      json: { currentPassword: input.currentPassword, confirmation: "DELETE MY ACCOUNT" },
    });
    return z.union([
      deletionEnvelopeSchema,
      z.object({ message: z.string(), retentionNotice: z.string() }),
    ]).parse(payload);
  }

  return deletionEnvelopeSchema.parse(
    await apiRequest("/api/account/delete", {
      method: "DELETE",
      json: { currentPassword: input.currentPassword, confirmation: "DELETE MY ACCOUNT" },
    }),
  );
}

export function getBusinessDeletionStatus() {
  return apiRequest("/api/dashboard/account/deletion-request").then((payload) => deletionEnvelopeSchema.parse(payload));
}

export async function requestDeletionByEmail(email: string) {
  return z.object({ message: z.string().optional() }).passthrough().parse(
    await publicApiRequest("/api/account-deletion/request", {
      method: "POST",
      json: { email: z.email().parse(email.trim().toLowerCase()) },
    }),
  );
}
