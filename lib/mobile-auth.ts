import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import {
  isMobileAllowedRole,
  isMobileBusinessRole,
  isValidPkcePair,
  MOBILE_ACCESS_TOKEN_AUDIENCE,
  MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS,
  MOBILE_ACCESS_TOKEN_TYPE,
  MOBILE_AUTHORIZATION_CODE_LIFETIME_MS,
  MOBILE_CLIENT_ID,
  MOBILE_REFRESH_ABSOLUTE_LIFETIME_MS,
  MOBILE_REFRESH_IDLE_LIFETIME_MS,
  MOBILE_REFRESH_RETRY_GRACE_MS,
  mobileIssuer
} from "@/lib/mobile-auth-policy";
import { smsVerificationEnabled } from "@/services/sms";

const authorizationCodePrefix = "vmac1";
const refreshTokenPrefix = "vmrt1";
const minimumSecretBytes = 32;

const mobileUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  businessId: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true
} satisfies Prisma.UserSelect;

type MobileUser = Prisma.UserGetPayload<{ select: typeof mobileUserSelect }>;

export class MobileAuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "MobileAuthError";
    this.code = code;
    this.status = status;
  }
}

function requiredSecret(name: "MOBILE_JWT_SECRET" | "MOBILE_TOKEN_PEPPER") {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, "utf8") < minimumSecretBytes) {
    throw new Error(`${name} must be set to a random value of at least ${minimumSecretBytes} bytes.`);
  }
  return value;
}

function jwtSecret() {
  return new TextEncoder().encode(requiredSecret("MOBILE_JWT_SECRET"));
}

function hashOpaqueSecret(domain: "authorization-code" | "refresh-token", id: string, secret: string) {
  return createHmac("sha256", requiredSecret("MOBILE_TOKEN_PEPPER"))
    .update(domain)
    .update("\0")
    .update(id)
    .update("\0")
    .update(secret)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createOpaqueToken(prefix: string, domain: "authorization-code" | "refresh-token", id = randomUUID()) {
  const secret = randomBytes(32).toString("base64url");
  return {
    id,
    raw: `${prefix}.${id}.${secret}`,
    hash: hashOpaqueSecret(domain, id, secret)
  };
}

function parseOpaqueToken(value: string, prefix: string, domain: "authorization-code" | "refresh-token") {
  const match = new RegExp(`^${prefix}\\.([A-Za-z0-9_-]{16,64})\\.([A-Za-z0-9_-]{43})$`).exec(value);
  if (!match) return null;
  const [, id, secret] = match;
  return { id, secret, hash: hashOpaqueSecret(domain, id, secret) };
}

function createRefreshSuccessor(current: { id: string; secret: string }, id: string = randomUUID()) {
  const secret = createHmac("sha256", requiredSecret("MOBILE_TOKEN_PEPPER"))
    .update("refresh-successor\0")
    .update(current.id)
    .update("\0")
    .update(current.secret)
    .digest("base64url");
  return {
    id,
    raw: `${refreshTokenPrefix}.${id}.${secret}`,
    hash: hashOpaqueSecret("refresh-token", id, secret)
  };
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

function earlierDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function mobileUserPayload(user: MobileUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId
  };
}

function mobileEligibilityError(user: MobileUser) {
  if (!isMobileAllowedRole(user.role)) {
    return new MobileAuthError("mobile_role_not_allowed", "This account is not available in the mobile app.", 403);
  }
  if (isMobileBusinessRole(user.role) && !user.businessId) {
    return new MobileAuthError("business_scope_required", "This business account is not linked to a business.", 403);
  }
  if (!user.emailVerifiedAt) {
    return new MobileAuthError("verification_required", "Verify your email before using the mobile app.", 403);
  }
  if ((user.role === "CUSTOMER" || user.role === "OWNER") && smsVerificationEnabled() && !user.phoneVerifiedAt) {
    return new MobileAuthError("verification_required", "Verify your phone before using the mobile app.", 403);
  }
  return null;
}

async function signMobileAccessToken(userId: string, mobileSessionId: string) {
  return new SignJWT({ sid: mobileSessionId })
    .setProtectedHeader({ alg: "HS256", typ: MOBILE_ACCESS_TOKEN_TYPE, kid: "mobile-hs256-v1" })
    .setIssuer(mobileIssuer())
    .setAudience(MOBILE_ACCESS_TOKEN_AUDIENCE)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS}s`)
    .sign(jwtSecret());
}

export type MobileAccessSession = {
  user: SessionUser;
  mobileSessionId: string;
};

export function bearerTokenFromAuthorization(value: string | null) {
  if (value === null) return { present: false, token: null } as const;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(value);
  return match
    ? ({ present: true, token: match[1] } as const)
    : ({ present: true, token: null } as const);
}

export async function verifyMobileAccessToken(token: string): Promise<MobileAccessSession | null> {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, jwtSecret(), {
      issuer: mobileIssuer(),
      audience: MOBILE_ACCESS_TOKEN_AUDIENCE,
      algorithms: ["HS256"],
      clockTolerance: 5
    });
    if (protectedHeader.typ !== MOBILE_ACCESS_TOKEN_TYPE || typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }

    const now = new Date();
    const mobileSession = await prisma.mobileSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        clientId: MOBILE_CLIENT_ID,
        revokedAt: null,
        absoluteExpiresAt: { gt: now },
        idleExpiresAt: { gt: now }
      },
      select: {
        id: true,
        user: { select: mobileUserSelect }
      }
    });
    if (!mobileSession || mobileEligibilityError(mobileSession.user)) return null;

    return {
      mobileSessionId: mobileSession.id,
      user: mobileUserPayload(mobileSession.user)
    };
  } catch {
    return null;
  }
}

export async function createMobileAuthorizationCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}) {
  jwtSecret();
  requiredSecret("MOBILE_TOKEN_PEPPER");

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: mobileUserSelect });
  if (!user) throw new MobileAuthError("login_required", "Sign in to continue.", 401);
  const eligibilityError = mobileEligibilityError(user);
  if (eligibilityError) throw eligibilityError;

  const code = createOpaqueToken(authorizationCodePrefix, "authorization-code");
  const now = new Date();
  await prisma.$transaction([
    prisma.mobileAuthorizationCode.deleteMany({
      where: { userId: user.id, OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] }
    }),
    prisma.mobileAuthorizationCode.create({
      data: {
        id: code.id,
        userId: user.id,
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        codeHash: code.hash,
        expiresAt: addMilliseconds(now, MOBILE_AUTHORIZATION_CODE_LIFETIME_MS)
      }
    })
  ]);

  return code.raw;
}

type AuthorizationCodeExchangeInput = {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  platform: "IOS" | "ANDROID";
  deviceName?: string;
  appVersion?: string;
};

function oauthInvalidGrant(message = "The authorization grant is invalid or expired.") {
  return new MobileAuthError("invalid_grant", message, 400);
}

export async function exchangeMobileAuthorizationCode(input: AuthorizationCodeExchangeInput) {
  jwtSecret();
  const parsedCode = parseOpaqueToken(input.code, authorizationCodePrefix, "authorization-code");
  if (!parsedCode) throw oauthInvalidGrant();

  const now = new Date();
  const absoluteExpiresAt = addMilliseconds(now, MOBILE_REFRESH_ABSOLUTE_LIFETIME_MS);
  const idleExpiresAt = addMilliseconds(now, MOBILE_REFRESH_IDLE_LIFETIME_MS);
  const mobileSessionId = randomUUID();
  const refreshToken = createOpaqueToken(refreshTokenPrefix, "refresh-token");

  const result = await prisma.$transaction(
    async (tx) => {
      const authorizationCode = await tx.mobileAuthorizationCode.findUnique({
        where: { id: parsedCode.id },
        select: {
          id: true,
          clientId: true,
          redirectUri: true,
          codeChallenge: true,
          codeHash: true,
          expiresAt: true,
          usedAt: true,
          user: { select: mobileUserSelect }
        }
      });

      if (
        !authorizationCode ||
        !safeEqual(authorizationCode.codeHash, parsedCode.hash) ||
        authorizationCode.usedAt ||
        authorizationCode.expiresAt <= now ||
        authorizationCode.clientId !== input.clientId ||
        authorizationCode.redirectUri !== input.redirectUri ||
        !isValidPkcePair(input.codeVerifier, authorizationCode.codeChallenge)
      ) {
        return { kind: "invalid" } as const;
      }

      const eligibilityError = mobileEligibilityError(authorizationCode.user);
      if (eligibilityError) return { kind: "ineligible", error: eligibilityError } as const;

      const consumed = await tx.mobileAuthorizationCode.updateMany({
        where: { id: authorizationCode.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now }
      });
      if (consumed.count !== 1) return { kind: "invalid" } as const;

      await tx.mobileSession.create({
        data: {
          id: mobileSessionId,
          userId: authorizationCode.user.id,
          clientId: input.clientId,
          platform: input.platform,
          deviceName: input.deviceName,
          appVersion: input.appVersion,
          absoluteExpiresAt,
          idleExpiresAt,
          lastUsedAt: now,
          refreshTokens: {
            create: {
              id: refreshToken.id,
              generation: 0,
              tokenHash: refreshToken.hash,
              expiresAt: idleExpiresAt
            }
          }
        }
      });

      return { kind: "success", user: authorizationCode.user } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (result.kind === "invalid") throw oauthInvalidGrant();
  if (result.kind === "ineligible") throw result.error;

  return {
    accessToken: await signMobileAccessToken(result.user.id, mobileSessionId),
    refreshToken: refreshToken.raw,
    accessTokenExpiresIn: MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS,
    refreshTokenExpiresAt: idleExpiresAt,
    absoluteSessionExpiresAt: absoluteExpiresAt,
    user: mobileUserPayload(result.user)
  };
}

type RefreshGrantInput = {
  clientId: string;
  refreshToken: string;
  platform?: "IOS" | "ANDROID";
  deviceName?: string;
  appVersion?: string;
};

async function revokeFamilyInTransaction(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
  reason: string
) {
  await tx.mobileSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now, revocationReason: reason }
  });
  await tx.mobileRefreshToken.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: now }
  });
}

export async function refreshMobileToken(input: RefreshGrantInput) {
  jwtSecret();
  const parsedToken = parseOpaqueToken(input.refreshToken, refreshTokenPrefix, "refresh-token");
  if (!parsedToken) throw oauthInvalidGrant("The refresh token is invalid or expired.");

  const now = new Date();
  const successor = createRefreshSuccessor(parsedToken);

  const result = await prisma.$transaction(
    async (tx) => {
      const current = await tx.mobileRefreshToken.findUnique({
        where: { id: parsedToken.id },
        select: {
          id: true,
          generation: true,
          tokenHash: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          session: {
            select: {
              id: true,
              clientId: true,
              platform: true,
              absoluteExpiresAt: true,
              idleExpiresAt: true,
              revokedAt: true,
              user: { select: mobileUserSelect }
            }
          }
        }
      });

      if (!current || !safeEqual(current.tokenHash, parsedToken.hash) || current.session.clientId !== input.clientId) {
        return { kind: "invalid" } as const;
      }

      if (current.usedAt && !current.revokedAt) {
        const withinRetryGrace = now.getTime() - current.usedAt.getTime() <= MOBILE_REFRESH_RETRY_GRACE_MS;
        const eligibilityError = mobileEligibilityError(current.session.user);
        const sessionActive =
          !eligibilityError &&
          current.session.revokedAt === null &&
          current.session.idleExpiresAt > now &&
          current.session.absoluteExpiresAt > now;
        if (withinRetryGrace && sessionActive) {
          const existingSuccessor = await tx.mobileRefreshToken.findUnique({
            where: {
              sessionId_generation: {
                sessionId: current.session.id,
                generation: current.generation + 1
              }
            },
            select: { id: true, tokenHash: true, expiresAt: true, usedAt: true, revokedAt: true }
          });
          if (
            existingSuccessor &&
            !existingSuccessor.usedAt &&
            !existingSuccessor.revokedAt &&
            existingSuccessor.expiresAt > now
          ) {
            const retrySuccessor = createRefreshSuccessor(parsedToken, existingSuccessor.id);
            if (safeEqual(existingSuccessor.tokenHash, retrySuccessor.hash)) {
              return {
                kind: "success",
                mobileSessionId: current.session.id,
                absoluteExpiresAt: current.session.absoluteExpiresAt,
                idleExpiresAt: current.session.idleExpiresAt,
                refreshToken: retrySuccessor,
                user: current.session.user
              } as const;
            }
          }
        }
      }

      if (current.usedAt || current.revokedAt) {
        await revokeFamilyInTransaction(tx, current.session.id, now, "refresh_token_reuse");
        return { kind: "replay" } as const;
      }

      const eligibilityError = mobileEligibilityError(current.session.user);
      const expired =
        current.expiresAt <= now ||
        current.session.revokedAt !== null ||
        current.session.idleExpiresAt <= now ||
        current.session.absoluteExpiresAt <= now;
      if (eligibilityError || expired) {
        await revokeFamilyInTransaction(
          tx,
          current.session.id,
          now,
          eligibilityError ? "account_no_longer_eligible" : "session_expired"
        );
        return eligibilityError
          ? ({ kind: "ineligible", error: eligibilityError } as const)
          : ({ kind: "expired" } as const);
      }

      const consumed = await tx.mobileRefreshToken.updateMany({
        where: { id: current.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now }
      });
      if (consumed.count !== 1) {
        await revokeFamilyInTransaction(tx, current.session.id, now, "refresh_token_reuse");
        return { kind: "replay" } as const;
      }

      const nextIdleExpiry = earlierDate(
        addMilliseconds(now, MOBILE_REFRESH_IDLE_LIFETIME_MS),
        current.session.absoluteExpiresAt
      );
      await tx.mobileRefreshToken.create({
        data: {
          id: successor.id,
          sessionId: current.session.id,
          generation: current.generation + 1,
          tokenHash: successor.hash,
          expiresAt: nextIdleExpiry
        }
      });
      await tx.mobileSession.update({
        where: { id: current.session.id },
        data: {
          idleExpiresAt: nextIdleExpiry,
          lastUsedAt: now,
          platform: input.platform ?? current.session.platform,
          deviceName: input.deviceName,
          appVersion: input.appVersion
        }
      });

      return {
        kind: "success",
        mobileSessionId: current.session.id,
        absoluteExpiresAt: current.session.absoluteExpiresAt,
        idleExpiresAt: nextIdleExpiry,
        refreshToken: successor,
        user: current.session.user
      } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (result.kind === "replay") {
    throw new MobileAuthError("invalid_grant", "Refresh token reuse was detected. Sign in again.", 401);
  }
  if (result.kind === "ineligible") throw result.error;
  if (result.kind !== "success") throw oauthInvalidGrant("The refresh token is invalid or expired.");

  return {
    accessToken: await signMobileAccessToken(result.user.id, result.mobileSessionId),
    refreshToken: result.refreshToken.raw,
    accessTokenExpiresIn: MOBILE_ACCESS_TOKEN_LIFETIME_SECONDS,
    refreshTokenExpiresAt: result.idleExpiresAt,
    absoluteSessionExpiresAt: result.absoluteExpiresAt,
    user: mobileUserPayload(result.user)
  };
}

export async function revokeMobileSession(mobileSessionId: string, reason = "user_logout") {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await revokeFamilyInTransaction(tx, mobileSessionId, now, reason);
  });
}

export async function revokeAllMobileSessions(userId: string, reason: string, exceptSessionId?: string) {
  const now = new Date();
  const where = {
    userId,
    revokedAt: null,
    ...(exceptSessionId ? { id: { not: exceptSessionId } } : {})
  } satisfies Prisma.MobileSessionWhereInput;
  const sessions = await prisma.mobileSession.findMany({ where, select: { id: true } });
  if (!sessions.length) return 0;
  const sessionIds = sessions.map((session) => session.id);
  await prisma.$transaction([
    prisma.mobileSession.updateMany({
      where: { id: { in: sessionIds }, revokedAt: null },
      data: { revokedAt: now, revocationReason: reason }
    }),
    prisma.mobileRefreshToken.updateMany({
      where: { sessionId: { in: sessionIds }, revokedAt: null },
      data: { revokedAt: now }
    })
  ]);
  return sessionIds.length;
}

export function tokenResponse(payload: Awaited<ReturnType<typeof exchangeMobileAuthorizationCode>>) {
  return {
    token_type: "Bearer",
    access_token: payload.accessToken,
    expires_in: payload.accessTokenExpiresIn,
    refresh_token: payload.refreshToken,
    refresh_token_expires_at: payload.refreshTokenExpiresAt.toISOString(),
    absolute_session_expires_at: payload.absoluteSessionExpiresAt.toISOString(),
    user: payload.user
  };
}

export const mobileAuthInternals = {
  createOpaqueToken,
  parseOpaqueToken,
  hashOpaqueSecret,
  safeEqual
};
