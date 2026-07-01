import type { Prisma, PrismaClient } from "@prisma/client";
import {
  businessServiceTypeOptions,
  findBusinessServiceTypeOption,
  normalizeBusinessServiceType,
  type BusinessServiceTypeOption
} from "@/lib/business-service-types";

type PrismaReader = PrismaClient | Prisma.TransactionClient;

export type ResolvedBusinessServiceType = {
  id: string | null;
  name: string;
};

export async function listBusinessServiceTypes(db: PrismaReader): Promise<BusinessServiceTypeOption[]> {
  const serviceTypes = await db.businessServiceType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true
    }
  });

  return serviceTypes.length > 0
    ? serviceTypes.map((serviceType) => ({
        ...serviceType,
        description: serviceType.description ?? ""
      }))
    : businessServiceTypeOptions;
}

export async function resolveBusinessServiceType(
  db: PrismaReader,
  value: string
): Promise<ResolvedBusinessServiceType | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fallback = findBusinessServiceTypeOption(trimmed);
  const slug = fallback?.slug ?? normalizeBusinessServiceType(trimmed).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const serviceType = await db.businessServiceType.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: trimmed, mode: "insensitive" } },
        { slug: { equals: slug, mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      name: true
    }
  });

  if (serviceType) {
    return serviceType;
  }

  return fallback ? { id: null, name: fallback.name } : null;
}
