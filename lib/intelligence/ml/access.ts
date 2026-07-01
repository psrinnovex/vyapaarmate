import type { SessionUser } from "@/lib/session";

export function canManageIntelligenceModels(session: Pick<SessionUser, "role" | "businessId"> | null, businessId: string) {
  if (!session) return false;
  if (session.role === "SUPER_ADMIN") return true;
  return session.role === "OWNER" && session.businessId === businessId;
}

export function canReadBusinessIntelligence(session: Pick<SessionUser, "role" | "businessId"> | null, businessId: string) {
  if (!session) return false;
  if (session.role === "SUPER_ADMIN") return true;
  return Boolean(session.businessId && session.businessId === businessId);
}
