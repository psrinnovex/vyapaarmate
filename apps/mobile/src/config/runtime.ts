import Constants from "expo-constants";

export { APP_SCHEME, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI } from "@/config/mobile-contract";

export function normalizeApiOrigin(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("VyapaarMate API URL is missing.");
  }

  const url = new URL(value.trim());
  const localDevelopment = ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("VyapaarMate API URL must use HTTPS outside local development.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VyapaarMate API URL must be a plain origin.");
  }

  return url.origin;
}

export const API_ORIGIN = normalizeApiOrigin(Constants.expoConfig?.extra?.apiUrl);

export function buildExternalUrls(apiOrigin: string) {
  const origin = normalizeApiOrigin(apiOrigin);

  return {
    privacy: `${origin}/mobile/privacy`,
    terms: `${origin}/mobile/terms`,
    support: `${origin}/contact`,
  } as const;
}

export const externalUrls = buildExternalUrls(API_ORIGIN);
