import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createPasswordResetToken, passwordResetUrl, sendSupportAgentInviteEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { safeLog } from "@/lib/security/safe-logger";
import { emptySupportAgentRatingStats, getSupportAgentRatingStats, type SupportAgentRatingStats } from "@/lib/support-agent-ratings";
import { adminSupportAgentInviteSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

function mapSupportAgent(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: Date;
}, rating: SupportAgentRatingStats = emptySupportAgentRatingStats()) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role === "SUPER_ADMIN" ? "Super Admin" : "Support Agent",
    roleValue: user.role,
    canDelete: user.role === "SUPPORT_AGENT",
    createdAt: user.createdAt.toISOString(),
    rating
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agents = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "SUPPORT_AGENT"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
  });
  const agentRatingStats = await getSupportAgentRatingStats(agents.map((agent) => agent.id));

  return NextResponse.json({
    agents: agents.map((agent) => mapSupportAgent(agent, agentRatingStats.get(agent.id) ?? emptySupportAgentRatingStats()))
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = adminSupportAgentInviteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const passwordHash = await hashPassword(randomUUID());

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        passwordHash,
        role: "SUPPORT_AGENT"
      },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    });

    const reset = await createPasswordResetToken(user.id);
    const inviteUrl = passwordResetUrl(reset.token, "support", "/support");
    let invite:
      | { status: "sent" | "placeholder"; devInviteUrl?: string }
      | { status: "failed"; error: string };

    try {
      const delivery = await sendSupportAgentInviteEmail({
        email: user.email,
        name: user.name,
        inviteUrl
      });
      invite = {
        status: delivery.status === "placeholder" ? "placeholder" : "sent",
        devInviteUrl: process.env.NODE_ENV !== "production" && delivery.status === "placeholder" ? inviteUrl : undefined
      };
    } catch (error) {
      safeLog("error", "Support agent invite email delivery failed", { error });
      invite = {
        status: "failed",
        error: "Support agent account was created, but the invite email could not be sent. Ask them to use Forgot password."
      };
    }

    await writeAuditLog({
      userId: session.id,
      action: "SUPPORT_AGENT_INVITED",
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return NextResponse.json({ agent: mapSupportAgent(user), invite }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A user with that email or phone already exists." }, { status: 409 });
    }
    throw error;
  }
}
