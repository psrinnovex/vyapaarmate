import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export async function writeAuditLog(input: {
  userId?: string | null;
  businessId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      businessId: input.businessId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? undefined,
      metadata: input.metadata
    }
  });
}
