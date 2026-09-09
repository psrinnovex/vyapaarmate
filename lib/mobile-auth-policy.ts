import { createHash } from "node:crypto";
import { z } from "zod";
import { MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI } from "@/lib/mobile-client-contract";

export { MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI } from "@/lib/mobile-client-contract";

export const MOBILE_ACCESS_TOKEN_AUDIENCE = "vyapaarmate-native-api";
export const MOBILE_ACCESS_TOKEN_TYPE = "at+jwt";
export const MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS = 10 * 60;
export const MOBILE_AUTHORIZATION_CODE_LIFETIME_MS = 5 * 60_000;
export const MOBILE_REFRESH_IDLE_LIFETIME_MS = 30 * 24 * 60 * 60_000;
export const MOBILE_REFRESH_ABSOLUTE_LIFETIME_MS = 90 * 24 * 60 * 60_000;
export const MOBILE_REFRESH_RETRY_GRACE_MS = 30_000;

export const MOBILE_ALLOWED_ROLES = [
  "CUSTOMER",
  "OWNER",
  "MANAGER",
  "KITCHEN_STAFF",
  "DELIVERY_STAFF"
] as const;

export type MobileAllowedRole = (typeof MOBILE_ALLOWED_ROLES)[number];

const allowedRoleSet = new Set<string>(MOBILE_ALLOWED_ROLES);

export function isMobileAllowedRole(role: string): role is MobileAllowedRole {
  return allowedRoleSet.has(role);
}

export function isMobileBusinessRole(role: string) {
  return role === "OWNER" || role === "MANAGER" || role === "KITCHEN_STAFF" || role === "DELIVERY_STAFF";
}

const pkceValue = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);

export const mobileAuthorizeSchema = z
  .object({
    response_type: z.literal("code"),
    client_id: z.literal(MOBILE_CLIENT_ID),
    redirect_uri: z.literal(MOBILE_REDIRECT_URI),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal("S256"),
    state: z.string().min(16).max(512),
    portal: z.enum(["user", "business"]).optional()
  })
  .strict();

const mobileClientMetadataSchema = z.object({
  platform: z.enum(["IOS", "ANDROID"]),
  device_name: z.string().trim().min(1).max(100).optional(),
  app_version: z.string().trim().min(1).max(32).optional()
});

export const mobileAuthorizationCodeGrantSchema = mobileClientMetadataSchema
  .extend({
    grant_type: z.literal("authorization_code"),
    client_id: z.literal(MOBILE_CLIENT_ID),
    redirect_uri: z.literal(MOBILE_REDIRECT_URI),
    code: z.string().min(48).max(300),
    code_verifier: pkceValue
  })
  .strict();

export const mobileRefreshGrantSchema = mobileClientMetadataSchema
  .partial({ platform: true })
  .extend({
    grant_type: z.literal("refresh_token"),
    client_id: z.literal(MOBILE_CLIENT_ID),
    refresh_token: z.string().min(48).max(300)
  })
  .strict();

export const mobileTokenRequestSchema = z.discriminatedUnion("grant_type", [
  mobileAuthorizationCodeGrantSchema,
  mobileRefreshGrantSchema
]);

export const mobileRevokeAllSchema = z
  .object({
    current_password: z.string().min(1).max(256)
  })
  .strict();

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function isValidPkcePair(verifier: string, challenge: string) {
  return pkceValue.safeParse(verifier).success && pkceChallenge(verifier) === challenge;
}

export function mobileIssuer() {
  const configured = process.env.MOBILE_TOKEN_ISSUER?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.vyapaarmate.com").replace(/\/$/, "");
}
