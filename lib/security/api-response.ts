import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function noStoreHeaders(extra?: HeadersInit) {
  return {
    "Cache-Control": "no-store",
    ...extra
  };
}

export function apiError(message: string, status = 400, init?: { headers?: HeadersInit }) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: noStoreHeaders(init?.headers)
    }
  );
}

export function apiValidationError(error: ZodError) {
  return NextResponse.json(
    { error: error.flatten() },
    {
      status: 400,
      headers: noStoreHeaders()
    }
  );
}

export function apiUnauthorized(message = "Unauthorized") {
  return apiError(message, 401);
}

export function apiForbidden(message = "Forbidden") {
  return apiError(message, 403);
}
