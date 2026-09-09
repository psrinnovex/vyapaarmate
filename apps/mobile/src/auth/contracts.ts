import { z } from "zod";

export const mobileRoleSchema = z.enum([
  "CUSTOMER",
  "OWNER",
  "MANAGER",
  "KITCHEN_STAFF",
  "DELIVERY_STAFF",
]);

export type MobileRole = z.infer<typeof mobileRoleSchema>;

export const mobileUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  role: mobileRoleSchema,
  businessId: z.string().min(1).nullable().optional(),
});

export type MobileUser = z.infer<typeof mobileUserSchema>;

export const tokenResponseSchema = z.object({
  token_type: z.literal("Bearer"),
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().max(3600),
  refresh_token: z.string().min(32),
  refresh_token_expires_at: z.iso.datetime(),
  absolute_session_expires_at: z.iso.datetime(),
  user: mobileUserSchema,
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const accountDeletionSchema = z.object({
  id: z.string().min(1),
  scope: z.string().min(1),
  status: z.string().min(1),
  scheduledFor: z.iso.datetime().nullable(),
  processingAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  retentionNoticeVersion: z.string().min(1),
  retentionNotice: z.string().min(1),
  result: z.unknown().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AccountDeletion = z.infer<typeof accountDeletionSchema>;

export const businessRoles: ReadonlySet<MobileRole> = new Set([
  "OWNER",
  "MANAGER",
  "KITCHEN_STAFF",
  "DELIVERY_STAFF",
]);

export function isBusinessRole(role: MobileRole): role is Exclude<MobileRole, "CUSTOMER"> {
  return businessRoles.has(role);
}
