import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetToken } from "@/lib/password-reset";
import { cookieName } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { homePathForRole, portalForRole, signInPathForPortal } from "@/lib/auth-portal";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const bucket = await rateLimit(`reset-password:${ip}`, 8, 10 * 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many reset attempts. Request a new link and try again." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  const reset = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (consumed.count !== 1) return null;

    const passwordResetToken = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            businessId: true,
            role: true
          }
        }
      }
    });

    if (!passwordResetToken) return null;

    await tx.user.update({
      where: { id: passwordResetToken.userId },
      data: { passwordHash, emailVerifiedAt: now }
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: passwordResetToken.userId,
        usedAt: null
      },
      data: { usedAt: now }
    });

    return passwordResetToken;
  });

  if (!reset) {
    return NextResponse.json(
      { error: "This reset link is invalid or expired. Request a new password reset link." },
      { status: 400 }
    );
  }

  const portal = portalForRole(reset.user.role);
  await writeAuditLog({
    userId: reset.user.id,
    businessId: reset.user.businessId,
    action: "AUTH_PASSWORD_RESET",
    entity: "User",
    entityId: reset.user.id,
    metadata: { ip }
  });

  const response = NextResponse.json({
    message: "Your password has been updated. Sign in with the new password.",
    portal,
    redirectPath: homePathForRole(reset.user.role),
    signInPath: signInPathForPortal(portal, homePathForRole(reset.user.role))
  });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    priority: "high",
    path: "/",
    maxAge: 0
  });
  return response;
}
