import { nativeSession } from "@/auth/session";
import { API_ORIGIN } from "@/config/runtime";

const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string") return error;
  return fallback;
}

async function runRequest(path: string, init: RequestInit, token?: string) {
  assertApiPath(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetch(new URL(path, API_ORIGIN).toString(), {
      ...init,
      credentials: "omit",
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function assertApiPath(path: string) {
  if (!path.startsWith("/api/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Authenticated requests must use a relative VyapaarMate API path.");
  }
  const resolved = new URL(path, API_ORIGIN);
  if (resolved.origin !== API_ORIGIN || !resolved.pathname.startsWith("/api/")) {
    throw new Error("Authenticated requests cannot leave the VyapaarMate API origin.");
  }
}

async function parseResponse(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, `Request failed (${response.status}).`), response.status, payload);
  }
  return payload;
}

export async function apiRequest(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<unknown> {
  const { json, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const prepared: RequestInit = {
    ...requestInit,
    headers,
    body: json === undefined ? requestInit.body : JSON.stringify(json),
  };

  let token = await nativeSession.getAccessToken();
  let response = await runRequest(path, prepared, token);
  if (response.status === 401) {
    token = await nativeSession.getAccessToken(true);
    response = await runRequest(path, prepared, token);
  }
  return parseResponse(response);
}

export async function publicApiRequest(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<unknown> {
  const { json, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const response = await runRequest(path, {
    ...requestInit,
    headers,
    body: json === undefined ? requestInit.body : JSON.stringify(json),
  });
  return parseResponse(response);
}
