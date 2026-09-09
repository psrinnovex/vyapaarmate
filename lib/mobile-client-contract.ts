export const MOBILE_CLIENT_ID = "vyapaarmate-mobile";
export const MOBILE_REDIRECT_URI = "com.pshrinnovex.vyapaarmate://oauth2redirect";

export type MobileAuthorizationPortal = "user" | "business";

const mobileAuthorizePath = "/api/mobile/v1/auth/authorize";
const mobileAuthorizeKeys = new Set([
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "portal"
]);

/**
 * Recognize only the fixed first-party native PKCE authorization request.
 * This is intentionally strict because auth pages use it to remove all
 * website/commerce navigation while the system browser belongs to the app.
 */
export function mobileAuthorizationPortal(value: string | string[] | null | undefined): MobileAuthorizationPortal | null {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;

  let url: URL;
  try {
    url = new URL(path, "https://mobile-auth.invalid");
  } catch {
    return null;
  }

  if (url.origin !== "https://mobile-auth.invalid" || url.pathname !== mobileAuthorizePath || url.hash) return null;

  for (const key of url.searchParams.keys()) {
    if (!mobileAuthorizeKeys.has(key) || url.searchParams.getAll(key).length !== 1) return null;
  }

  if (url.searchParams.size !== mobileAuthorizeKeys.size) return null;
  if (url.searchParams.get("response_type") !== "code") return null;
  if (url.searchParams.get("client_id") !== MOBILE_CLIENT_ID) return null;
  if (url.searchParams.get("redirect_uri") !== MOBILE_REDIRECT_URI) return null;
  if (url.searchParams.get("code_challenge_method") !== "S256") return null;

  const challenge = url.searchParams.get("code_challenge") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return null;

  const state = url.searchParams.get("state") ?? "";
  if (state.length < 16 || state.length > 512) return null;

  const portal = url.searchParams.get("portal");
  return portal === "user" || portal === "business" ? portal : null;
}

export function isMobileAuthorizationPath(value: string | string[] | null | undefined) {
  return mobileAuthorizationPortal(value) !== null;
}
