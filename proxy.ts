import { NextResponse, type NextRequest } from "next/server";
import { homePathForRole } from "@/lib/auth-portal";
import { cookieName, verifySessionToken } from "@/lib/session";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const externalCallbackPrefixes = ["/api/webhooks/", "/api/jobs/"];

function redirectToLogin(request: NextRequest, clearSession = false) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (isPathWithin(request.nextUrl.pathname, "/support")) loginUrl.searchParams.set("type", "support");
  const response = NextResponse.redirect(loginUrl);

  if (clearSession) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      priority: "high",
      path: "/",
      maxAge: 0
    });
  }

  return response;
}

function redirectToPath(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function configuredTrustedOrigins(request: NextRequest) {
  const origins = new Set([request.nextUrl.origin]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // The production env checker reports invalid values; proxy should stay resilient.
    }
  }

  for (const value of (process.env.TRUSTED_ORIGINS ?? "").split(",")) {
    const origin = value.trim();
    if (!origin) continue;
    try {
      origins.add(new URL(origin).origin);
    } catch {
      origins.add(origin.replace(/\/$/, ""));
    }
  }

  return origins;
}

function originFromHeader(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isTrustedOrigin(request: NextRequest, origin: string | null) {
  return Boolean(origin && configuredTrustedOrigins(request).has(origin));
}

function rejectCrossOriginRequest() {
  return NextResponse.json(
    { error: "Cross-origin API request blocked." },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
        Vary: "Origin, Sec-Fetch-Site"
      }
    }
  );
}

function isPathWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function protectUnsafeApiRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return null;
  if (!unsafeMethods.has(request.method.toUpperCase())) return null;
  if (externalCallbackPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return rejectCrossOriginRequest();

  const origin = originFromHeader(request.headers.get("origin"));
  if (request.headers.has("origin") && !isTrustedOrigin(request, origin)) {
    return rejectCrossOriginRequest();
  }

  const refererOrigin = originFromHeader(request.headers.get("referer"));
  if (!origin && request.headers.has("referer") && !isTrustedOrigin(request, refererOrigin)) {
    return rejectCrossOriginRequest();
  }

  if (
    process.env.NODE_ENV === "production" &&
    request.cookies.has(cookieName) &&
    !origin &&
    !refererOrigin &&
    fetchSite !== "same-origin" &&
    fetchSite !== "same-site"
  ) {
    return rejectCrossOriginRequest();
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(cookieName)?.value;
  const isDashboardPath = isPathWithin(pathname, "/dashboard");
  const isAdminPath = isPathWithin(pathname, "/admin");
  const isSupportPath = isPathWithin(pathname, "/support");
  const isUserPath = isPathWithin(pathname, "/user");
  const isProtectedPage = isDashboardPath || isAdminPath || isSupportPath || isUserPath;

  const unsafeApiResponse = protectUnsafeApiRequest(request);
  if (unsafeApiResponse) return unsafeApiResponse;

  if (!isProtectedPage) {
    return NextResponse.next();
  }

  if (!token) {
    return redirectToLogin(request);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return redirectToLogin(request, true);
  }

  if (isAdminPath && session.role !== "SUPER_ADMIN") {
    return redirectToPath(request, homePathForRole(session.role));
  }

  if (isSupportPath && session.role !== "SUPPORT_AGENT") {
    return redirectToPath(request, homePathForRole(session.role));
  }

  if (isUserPath && session.role !== "CUSTOMER") {
    return redirectToPath(request, homePathForRole(session.role));
  }

  if (isDashboardPath) {
    if (session.role === "SUPER_ADMIN" || session.role === "SUPPORT_AGENT" || session.role === "CUSTOMER") {
      return redirectToPath(request, homePathForRole(session.role));
    }

    if (!session.businessId) {
      return redirectToLogin(request);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/admin/:path*", "/support/:path*", "/user/:path*"]
};
