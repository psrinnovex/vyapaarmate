import type { Business } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import type { WhatsAppProviderConfig } from "@/services/whatsapp";

type BusinessWhatsappFields = Pick<
  Business,
  "whatsappAccessTokenEnc" | "whatsappPhoneNumberId" | "whatsappLiveEnabled" | "whatsappConnected"
>;

export function businessWhatsappConfig(business: BusinessWhatsappFields): WhatsAppProviderConfig {
  if (
    !business.whatsappConnected ||
    !business.whatsappLiveEnabled ||
    !business.whatsappAccessTokenEnc ||
    !business.whatsappPhoneNumberId
  ) {
    return { liveSendsEnabled: false };
  }

  return {
    liveSendsEnabled: true,
    accessToken: decryptSecret(business.whatsappAccessTokenEnc),
    phoneNumberId: business.whatsappPhoneNumberId
  };
}

export function businessWhatsappStatus(
  business: Pick<Business, "whatsappConnected" | "whatsappLiveEnabled" | "whatsappAccessTokenEnc" | "whatsappPhoneNumberId">
) {
  if (!business.whatsappPhoneNumberId || !business.whatsappAccessTokenEnc) return "Not configured";
  if (!business.whatsappConnected) return "Pending setup";
  if (!business.whatsappLiveEnabled) return "Pending PSHR approval";
  return "Live";
}
