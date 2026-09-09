import { NextResponse } from "next/server";
import { getCookieSessionUser } from "@/lib/api-session";
import { signInPathForPortal } from "@/lib/auth-portal";
import { writeAuditLog } from "@/lib/audit";
import { createMobileAuthorizationCode, MobileAuthError } from "@/lib/mobile-auth";
import {
  isMobileBusinessRole,
  mobileAuthorizeSchema,
  MOBILE_REDIRECT_URI
} from "@/lib/mobile-auth-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(payload: unknown, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" }
  });
}

function oauthRedirect(state: string, params: Record<string, string>) {
  const redirect = new URL(MOBILE_REDIRECT_URI);
  redirect.searchParams.set("state", state);
  for (const [key, value] of Object.entries(params)) redirect.searchParams.set(key, value);
  return NextResponse.redirect(redirect, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = Object.fromEntries(url.searchParams.entries());
  const parsed = mobileAuthorizeSchema.safeParse(input);
  if (!parsed.success) {
    return noStoreJson(
      { error: "invalid_request", error_description: "The mobile authorization request is invalid." },
      400
    );
  }

  const duplicatedParameter = Object.keys(input).find((key) => url.searchParams.getAll(key).length !== 1);
  if (duplicatedParameter) {
    return noStoreJson(
      { error: "invalid_request", error_description: "Authorization parameters must be supplied once." },
      400
    );
  }

  const session = await getCookieSessionUser();
  if (!session) {
    const nextPath = `${url.pathname}${url.search}`;
    const portal = parsed.data.portal ?? "business";
    return NextResponse.redirect(new URL(signInPathForPortal(portal, nextPath), request.url));
  }

  try {
    const requestedPortal = parsed.data.portal ?? "business";
    const roleMatchesPortal =
      requestedPortal === "user"
        ? session.role === "CUSTOMER"
        : isMobileBusinessRole(session.role);
    if (!roleMatchesPortal) {
      throw new MobileAuthError("portal_mismatch", "This account cannot use the requested mobile area.", 403);
    }
    const code = await createMobileAuthorizationCode({
      userId: session.id,
      clientId: parsed.data.client_id,
      redirectUri: parsed.data.redirect_uri,
      codeChallenge: parsed.data.code_challenge
    });

    await writeAuditLog({
      userId: session.id,
      businessId: session.businessId,
      action: "MOBILE_AUTHORIZATION_CODE_ISSUED",
      entity: "User",
      entityId: session.id,
      metadata: { clientId: parsed.data.client_id }
    });

    return oauthRedirect(parsed.data.state, { code });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      await writeAuditLog({
        userId: session.id,
        businessId: session.businessId,
        action: "MOBILE_AUTHORIZATION_DENIED",
        entity: "User",
        entityId: session.id,
        metadata: { code: error.code }
      }).catch(() => undefined);
      return oauthRedirect(parsed.data.state, {
        error: "access_denied",
        error_description: "This account is not available in the mobile app."
      });
    }
    return noStoreJson({ error: "server_error", error_description: "Authorization is temporarily unavailable." }, 503);
  }
}
