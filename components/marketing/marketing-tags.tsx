import { MarketingTagsClient } from "@/components/marketing/marketing-tags-client";

const gtmPattern = /^GTM-[A-Z0-9]+$/i;
const gaPattern = /^G-[A-Z0-9]+$/i;

function cleanEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function validId(value: string, pattern: RegExp) {
  return pattern.test(value) ? value : "";
}

export function MarketingTags() {
  const gtmId = validId(cleanEnv("NEXT_PUBLIC_GTM_ID"), gtmPattern);
  const gaMeasurementId = validId(cleanEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID"), gaPattern);
  return <MarketingTagsClient gtmId={gtmId} gaMeasurementId={gaMeasurementId} />;
}
