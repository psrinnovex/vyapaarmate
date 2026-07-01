import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const cookieName = "vyapaarmate_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  businessId?: string | null;
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be set to a long random value.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId ?? null
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (!payload.sub || !payload.email || !payload.role || !payload.name) return null;
    return {
      id: payload.sub,
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      businessId: typeof payload.businessId === "string" ? payload.businessId : null
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return {
    name: cookieName,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      priority: "high" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    }
  };
}

export { cookieName };
