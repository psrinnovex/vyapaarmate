import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken, passwordResetUrl, sendPasswordResetEmail } from "@/lib/password-reset";
import { homePathForRole, portalForRole } from "@/lib/auth-portal";

const publicMessage = "If an account exists for that email, a secure password reset link has been sent.";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipBucket = await rateLimit(`forgot-password:${ip}`, 5, 15 * 60_000);
  if (!ipBucket.allowed) {
    return NextResponse.json({ error: "Too many reset requests. Try again in a few minutes." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const emailBucket = await rateLimit(`forgot-password:${email}`, 3, 15 * 60_000);
  if (!emailBucket.allowed) {
    return NextResponse.json({ message: publicMessage });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  if (!user) {
    return NextResponse.json({ message: publicMessage });
  }

  const portal = portalForRole(user.role);
  if (parsed.data.portal && parsed.data.portal !== portal) {
    return NextResponse.json({ message: publicMessage });
  }

  const reset = await createPasswordResetToken(user.id);
  const resetUrl = passwordResetUrl(reset.token, portal, homePathForRole(user.role));

  try {
    const delivery = await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
      portal
    });

    return NextResponse.json({
      message: publicMessage,
      devResetUrl: process.env.NODE_ENV !== "production" && delivery.status === "placeholder" ? resetUrl : undefined
    });
  } catch (error) {
    console.error("Password reset email delivery failed", error);
    return NextResponse.json(
      { error: "We could not send password reset emails right now. Try again shortly." },
      { status: 503 }
    );
  }
}
