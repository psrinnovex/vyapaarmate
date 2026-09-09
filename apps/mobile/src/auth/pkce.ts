import * as Crypto from "expo-crypto";
import { APP_SCHEME, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI } from "@/config/mobile-contract";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeBase64(bytes: Uint8Array) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += BASE64[(value >> 18) & 63];
    result += BASE64[(value >> 12) & 63];
    result += second === undefined ? "=" : BASE64[(value >> 6) & 63];
    result += third === undefined ? "=" : BASE64[value & 63];
  }
  return result;
}

export function toBase64Url(value: string) {
  return value.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export async function createPkceRequest() {
  const verifier = toBase64Url(encodeBase64(await Crypto.getRandomBytesAsync(32)));
  const state = toBase64Url(encodeBase64(await Crypto.getRandomBytesAsync(24)));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, state, challenge: toBase64Url(digest) };
}

function constantTimeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function buildAuthorizationUrl(
  apiOrigin: string,
  portal: "user" | "business",
  request: { challenge: string; state: string },
) {
  const url = new URL("/api/mobile/v1/auth/authorize", apiOrigin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", MOBILE_CLIENT_ID);
  url.searchParams.set("redirect_uri", MOBILE_REDIRECT_URI);
  url.searchParams.set("code_challenge", request.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", request.state);
  url.searchParams.set("portal", portal);
  return url.toString();
}

export function parseAuthorizationCallback(value: string, expectedState: string) {
  const url = new URL(value);
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== "oauth2redirect" || (url.pathname !== "" && url.pathname !== "/")) {
    throw new Error("The sign-in response used an unexpected redirect.");
  }

  const returnedState = url.searchParams.get("state") ?? "";
  if (!constantTimeEqual(returnedState, expectedState)) {
    throw new Error("The sign-in response could not be verified. Please try again.");
  }

  const error = url.searchParams.get("error");
  if (error) {
    throw new Error(url.searchParams.get("error_description") || "VyapaarMate sign-in was denied.");
  }

  const code = url.searchParams.get("code");
  if (!code) throw new Error("The sign-in response did not include an authorization code.");
  return code;
}
