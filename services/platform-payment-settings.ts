import { prisma } from "@/lib/prisma";
import { isValidUpiId } from "@/services/upi";

export const PLATFORM_PAYMENT_SETTINGS_ID = "platform";
export const DEFAULT_PLATFORM_RECEIVER_NAME = "PSHR INNOVEX PRIVATE LIMITED";

export type PlatformPaymentSettingsValue = {
  directUpiEnabled: boolean;
  upiId: string | null;
  upiName: string;
  updatedAt: Date | null;
};

export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettingsValue> {
  const settings = await prisma.platformPaymentSettings.findUnique({
    where: { id: PLATFORM_PAYMENT_SETTINGS_ID }
  });

  return {
    directUpiEnabled: Boolean(settings?.directUpiEnabled && isValidUpiId(settings.upiId)),
    upiId: settings?.upiId ?? null,
    upiName: settings?.upiName?.trim() || process.env.PAYMENT_RECEIVER_NAME?.trim() || DEFAULT_PLATFORM_RECEIVER_NAME,
    updatedAt: settings?.updatedAt ?? null
  };
}

export async function savePlatformPaymentSettings(input: {
  directUpiEnabled: boolean;
  upiId: string | null;
  upiName: string;
  updatedByUserId: string;
}) {
  return prisma.platformPaymentSettings.upsert({
    where: { id: PLATFORM_PAYMENT_SETTINGS_ID },
    update: {
      directUpiEnabled: input.directUpiEnabled,
      upiId: input.upiId,
      upiName: input.upiName,
      updatedByUserId: input.updatedByUserId
    },
    create: {
      id: PLATFORM_PAYMENT_SETTINGS_ID,
      directUpiEnabled: input.directUpiEnabled,
      upiId: input.upiId,
      upiName: input.upiName,
      updatedByUserId: input.updatedByUserId
    }
  });
}
