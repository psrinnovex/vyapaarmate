import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getSessionUser } from "@/lib/api-session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const bucket = await rateLimit(`change-password:${session.id}:${ip}`, 6, 10 * 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many password attempts. Try again in a few minutes." }, { status: 429 });
  }

  const parsed = changePasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      passwordHash: true,
      businessId: true,
      role: true
    }
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentPasswordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!currentPasswordValid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const unchangedPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (unchangedPassword) {
    return NextResponse.json({ error: "Choose a password that is different from your current password." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now }
    });
  });

  await writeAuditLog({
    userId: user.id,
    businessId: user.businessId,
    action: "AUTH_PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
    metadata: { ip, role: user.role }
  });

  return NextResponse.json({ message: "Password updated successfully." });
}
