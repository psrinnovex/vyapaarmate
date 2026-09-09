import Constants from "expo-constants";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { API_ORIGIN, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI } from "@/config/runtime";
import { buildAuthorizationUrl, createPkceRequest, parseAuthorizationCallback } from "@/auth/pkce";
import {
  isBusinessRole,
  tokenResponseSchema,
  type MobileUser,
  type TokenResponse,
} from "@/auth/contracts";
import {
  deleteRefreshToken,
  initializeTokenVault,
  readRefreshToken,
  writeRefreshToken,
} from "@/auth/token-vault";

const REQUEST_TIMEOUT_MS = 15_000;
const EXPIRY_SKEW_MS = 30_000;

type AuthSnapshot =
  | { status: "loading"; user: null; error: null }
  | { status: "anonymous"; user: null; error: string | null }
  | { status: "recoverable-error"; user: null; error: string }
  | { status: "authenticated"; user: MobileUser; error: null };

class AuthHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthHttpError";
  }
}

function messageFromPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  return typeof record.error_description === "string"
    ? record.error_description
    : typeof record.error === "string"
      ? record.error
      : fallback;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, credentials: "omit", signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestToken(body: Record<string, unknown>) {
  const response = await fetchWithTimeout(`${API_ORIGIN}/api/mobile/v1/auth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload && typeof payload === "object" ? (payload as Record<string, unknown>).error : undefined;
    throw new AuthHttpError(
      messageFromPayload(payload, "VyapaarMate could not refresh this session."),
      response.status,
      typeof code === "string" ? code : undefined,
    );
  }
  return payload;
}

async function revokeBearer(accessToken: string) {
  await fetchWithTimeout(`${API_ORIGIN}/api/mobile/v1/auth/revoke`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
}

const terminalAuthCodes = new Set([
  "invalid_grant",
  "mobile_role_not_allowed",
  "business_scope_required",
  "verification_required",
]);

function isTerminalAuthError(error: unknown) {
  return error instanceof AuthHttpError && Boolean(error.code && terminalAuthCodes.has(error.code));
}

class NativeSession {
  private snapshot: AuthSnapshot = { status: "loading", user: null, error: null };
  private listeners = new Set<() => void>();
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private bootstrapPromise: Promise<void> | null = null;
  private refreshPromise: Promise<TokenResponse> | null = null;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: AuthSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  private async parseAndPersist(payload: unknown) {
    const parsed = tokenResponseSchema.safeParse(payload);
    if (!parsed.success) {
      const possibleToken =
        payload && typeof payload === "object" ? (payload as Record<string, unknown>).access_token : null;
      if (typeof possibleToken === "string") await revokeBearer(possibleToken).catch(() => undefined);
      await this.forgetSession();
      throw new Error("The server returned an invalid mobile session.");
    }

    try {
      await writeRefreshToken(parsed.data.refresh_token);
    } catch {
      await revokeBearer(parsed.data.access_token).catch(() => undefined);
      await this.forgetSession();
      throw new Error("The secure session could not be saved on this device.");
    }

    this.accessToken = parsed.data.access_token;
    this.accessTokenExpiresAt = Date.now() + parsed.data.expires_in * 1000;
    this.publish({ status: "authenticated", user: parsed.data.user, error: null });
    return parsed.data;
  }

  bootstrap() {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = (async () => {
      this.publish({ status: "loading", user: null, error: null });
      try {
        await initializeTokenVault();
        const refreshToken = await readRefreshToken();
        if (!refreshToken) {
          this.publish({ status: "anonymous", user: null, error: null });
          return;
        }
        await this.refresh();
      } catch (error) {
        if (isTerminalAuthError(error)) {
          await this.forgetSession();
          return;
        }
        const message = error instanceof Error ? error.message : "Could not restore this session.";
        this.publish({ status: "recoverable-error", user: null, error: message });
      }
    })();
    return this.bootstrapPromise;
  }

  async retryRestore() {
    this.publish({ status: "loading", user: null, error: null });
    try {
      await this.refresh();
    } catch (error) {
      if (isTerminalAuthError(error)) {
        await this.forgetSession();
        return;
      }
      const message = error instanceof Error ? error.message : "Could not restore this session.";
      this.publish({ status: "recoverable-error", user: null, error: message });
    }
  }

  async signIn(portal: "user" | "business") {
    const request = await createPkceRequest();
    const result = await WebBrowser.openAuthSessionAsync(
      buildAuthorizationUrl(API_ORIGIN, portal, request),
      MOBILE_REDIRECT_URI,
      { preferEphemeralSession: false },
    );
    if (result.type !== "success") {
      throw new Error(result.type === "cancel" ? "Sign-in was cancelled." : "Sign-in did not finish.");
    }

    const code = parseAuthorizationCallback(result.url, request.state);
    const payload = await requestToken({
      grant_type: "authorization_code",
      client_id: MOBILE_CLIENT_ID,
      redirect_uri: MOBILE_REDIRECT_URI,
      code,
      code_verifier: request.verifier,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
      app_version: Constants.expoConfig?.version ?? "1.0.0",
    });
    const parsed = tokenResponseSchema.safeParse(payload);
    if (!parsed.success) return this.parseAndPersist(payload);
    const correctPortal = portal === "user" ? parsed.data.user.role === "CUSTOMER" : isBusinessRole(parsed.data.user.role);
    if (!correctPortal) {
      await revokeBearer(parsed.data.access_token).catch(() => undefined);
      throw new Error(`This account cannot use the ${portal === "user" ? "customer" : "business"} app area.`);
    }
    return this.parseAndPersist(parsed.data);
  }

  private refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) throw new AuthHttpError("This session has ended.", 401, "invalid_grant");
      try {
        const payload = await requestToken({
          grant_type: "refresh_token",
          client_id: MOBILE_CLIENT_ID,
          refresh_token: refreshToken,
          platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
          app_version: Constants.expoConfig?.version ?? "1.0.0",
        });
        return await this.parseAndPersist(payload);
      } catch (error) {
        if (isTerminalAuthError(error)) await this.forgetSession();
        throw error;
      }
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  async getAccessToken(forceRefresh = false) {
    if (!forceRefresh && this.accessToken && this.accessTokenExpiresAt - Date.now() > EXPIRY_SKEW_MS) {
      return this.accessToken;
    }
    await this.refresh();
    if (!this.accessToken) throw new AuthHttpError("This session has ended.", 401);
    return this.accessToken;
  }

  async refreshOnResume() {
    if (this.snapshot.status !== "authenticated") return;
    if (this.accessToken && this.accessTokenExpiresAt - Date.now() > EXPIRY_SKEW_MS) return;
    // Retryable failures deliberately leave the authenticated snapshot and
    // encrypted refresh token intact. API screens can show their own retry UI.
    await this.getAccessToken().catch(() => undefined);
  }

  peekAccessToken() {
    return this.accessToken;
  }

  async signOut() {
    const token = this.accessToken;
    if (token) await revokeBearer(token).catch(() => undefined);
    await this.forgetSession();
  }

  async forgetSession() {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    await deleteRefreshToken().catch(() => undefined);
    this.publish({ status: "anonymous", user: null, error: null });
  }
}

WebBrowser.maybeCompleteAuthSession();

export const nativeSession = new NativeSession();
export type { AuthSnapshot };
