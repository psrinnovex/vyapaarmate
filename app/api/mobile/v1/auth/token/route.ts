import { NextResponse } from "next/server";
import { z } from "zod";
import {
  exchangeMobileAuthorizationCode,
  MobileAuthError,
  refreshMobileToken,
  tokenResponse
} from "@/lib/mobile-auth";
import { mobileTokenRequestSchema } from "@/lib/mobile-auth-policy";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" }
  });
}

async function tokenBody(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(await request.text()).entries());
  }
  if (contentType === "application/json") return request.json();
  throw new MobileAuthError("invalid_request", "Use JSON or form-encoded token parameters.", 415);
}

export async function POST(request: Request) {
  const bucket = await rateLimit(`mobile-token:${getClientIp(request)}`, 20, 60_000);
  if (!bucket.allowed) return response({ error: "temporarily_unavailable" }, 429);

  try {
    const parsed = mobileTokenRequestSchema.parse(await tokenBody(request));
    const issued =
      parsed.grant_type === "authorization_code"
        ? await exchangeMobileAuthorizationCode({
            clientId: parsed.client_id,
            redirectUri: parsed.redirect_uri,
            code: parsed.code,
            codeVerifier: parsed.code_verifier,
            platform: parsed.platform,
            deviceName: parsed.device_name,
            appVersion: parsed.app_version
          })
        : await refreshMobileToken({
            clientId: parsed.client_id,
            refreshToken: parsed.refresh_token,
            platform: parsed.platform,
            deviceName: parsed.device_name,
            appVersion: parsed.app_version
          });

    return response(tokenResponse(issued));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response({ error: "invalid_request", error_description: "The token request is invalid." }, 400);
    }
    if (error instanceof MobileAuthError) {
      return response({ error: error.code, error_description: error.message }, error.status);
    }
    return response({ error: "server_error", error_description: "Token issuance is temporarily unavailable." }, 503);
  }
}
