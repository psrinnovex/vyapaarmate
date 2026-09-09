import { businessRoles, mobileRoleSchema, tokenResponseSchema } from "@/auth/contracts";
import { describe, expect, it } from "@jest/globals";

describe("native authorization contract", () => {
  it("accepts customer and business product roles only", () => {
    for (const role of ["CUSTOMER", "OWNER", "MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"]) {
      expect(mobileRoleSchema.safeParse(role).success).toBe(true);
    }
    expect(mobileRoleSchema.safeParse("SUPER_ADMIN").success).toBe(false);
    expect(mobileRoleSchema.safeParse("SUPPORT_AGENT").success).toBe(false);
    expect(businessRoles.has("CUSTOMER")).toBe(false);
    expect(businessRoles.has("OWNER")).toBe(true);
  });

  it("rejects an overlong access-token lifetime", () => {
    const payload = {
      token_type: "Bearer",
      access_token: "access-token",
      expires_in: 3601,
      refresh_token: "r".repeat(48),
      refresh_token_expires_at: "2026-09-01T00:00:00.000Z",
      absolute_session_expires_at: "2026-10-01T00:00:00.000Z",
      user: { id: "user", name: "User", email: "user@example.com", role: "CUSTOMER" },
    };
    expect(tokenResponseSchema.safeParse(payload).success).toBe(false);
    expect(tokenResponseSchema.safeParse({ ...payload, expires_in: 600 }).success).toBe(true);
  });
});
