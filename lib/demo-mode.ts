/**
 * VyapaarMate demo environment.
 *
 * DEMO_MODE=true (server) turns on simulated payments and one-tap demo logins so the
 * MVP can be shown end to end without Cashfree or WhatsApp credentials. It refuses to
 * run next to live payment credentials (CASHFREE_ENV=production), so a demo flag can
 * never mark real orders as paid.
 *
 * NEXT_PUBLIC_DEMO_MODE=true only controls UI hints (the demo ribbon and demo copy).
 * Never use it to authorise anything.
 */

const truthy = (value: string | undefined) => ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());

export function isDemoMode() {
  if (!truthy(process.env.DEMO_MODE)) return false;
  if ((process.env.CASHFREE_ENV ?? "").trim().toLowerCase() === "production") return false;
  return true;
}

export const demoModeUiEnabled = truthy(process.env.NEXT_PUBLIC_DEMO_MODE);

export type DemoRole = "owner" | "staff" | "admin" | "support";

/** Seeded demo accounts (see prisma/seed.ts). Demo login is limited to exactly these emails. */
export function demoAccountEmail(role: DemoRole) {
  const emails: Record<DemoRole, string> = {
    owner: process.env.DEMO_OWNER_EMAIL ?? "owner@demo.com",
    staff: process.env.DEMO_STAFF_EMAIL ?? "kitchen@demo.com",
    admin: process.env.DEMO_ADMIN_EMAIL ?? "admin@pshrinnovex.com",
    support: process.env.DEMO_SUPPORT_EMAIL ?? "support@demo.com"
  };
  return emails[role].trim().toLowerCase();
}

export function isDemoRole(value: unknown): value is DemoRole {
  return value === "owner" || value === "staff" || value === "admin" || value === "support";
}

/** Public demo shop customers can order from. */
export const demoShopSlug = process.env.NEXT_PUBLIC_DEMO_SHOP_SLUG ?? "sri-sai-tiffins";
