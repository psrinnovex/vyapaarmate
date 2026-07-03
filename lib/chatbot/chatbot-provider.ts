export type ChatbotProviderConfig = {
  enabled: boolean;
  provider: string;
  model: string | null;
};

export function chatbotProviderConfig(): ChatbotProviderConfig {
  return {
    enabled: process.env.AI_PROVIDER_ENABLED === "true",
    provider: process.env.AI_PROVIDER_NAME?.trim() || "rules",
    model: process.env.AI_PROVIDER_MODEL?.trim() || null
  };
}

export function isChatbotAiProviderEnabled() {
  return chatbotProviderConfig().enabled;
}

export function chatbotProviderFallbackReply() {
  return "I can continue with safe rules-based support. For account-specific help, use the verified portal or support queue.";
}
