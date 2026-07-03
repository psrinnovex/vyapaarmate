import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { createPasswordResetToken, passwordResetUrl, sendSupportAgentInviteEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { safeLog } from "@/lib/security/safe-logger";
import { autoAssignSupportQueue } from "@/lib/support-agent-queue";
import { adminSupportAgentUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

async function findSupportAgent(agentId: string) {
  return prisma.user.findFirst({
    where: { id: agentId, role: "SUPPORT_AGENT" },
    select: { id: true, name: true, email: true, phone: true, role: true }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { agentId } = await context.params;
  const agent = await findSupportAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Support agent not found" }, { status: 404 });

  const parsed = adminSupportAgentUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updatedAgent = await prisma.user.update({
      where: { id: agent.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null
      },
      select: { id: true, name: true, email: true, phone: true }
    });

    await writeAuditLog({
      userId: session.id,
      action: "SUPPORT_AGENT_UPDATED",
      entity: "User",
      entityId: agent.id,
      metadata: {
        previous: { name: agent.name, email: agent.email, phone: agent.phone },
        current: { name: updatedAgent.name, email: updatedAgent.email, phone: updatedAgent.phone }
      }
    });

    return NextResponse.json({ updatedId: updatedAgent.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A user with that email or phone already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { agentId } = await context.params;
  const agent = await findSupportAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Support agent not found" }, { status: 404 });

  const reset = await createPasswordResetToken(agent.id);
  const inviteUrl = passwordResetUrl(reset.token, "support", "/support");

  try {
    const delivery = await sendSupportAgentInviteEmail({
      email: agent.email,
      name: agent.name,
      inviteUrl
    });

    await writeAuditLog({
      userId: session.id,
      action: "SUPPORT_AGENT_INVITE_RESENT",
      entity: "User",
      entityId: agent.id,
      metadata: { email: agent.email }
    });

    return NextResponse.json({
      invite: {
        status: delivery.status === "placeholder" ? "placeholder" : "sent",
        devInviteUrl: process.env.NODE_ENV !== "production" && delivery.status === "placeholder" ? inviteUrl : undefined
      }
    });
  } catch (error) {
    safeLog("error", "Support agent invite email delivery failed", { error });
    return NextResponse.json({ error: "Support agent invite email could not be sent right now." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { agentId } = await context.params;
  const agent = await findSupportAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Support agent not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.supportTicket.updateMany({
      where: { assignedToUserId: agent.id, status: { in: ["IN_REVIEW", "WAITING_ON_CUSTOMER"] } },
      data: { assignedToUserId: null, assignedAt: null, status: "OPEN" }
    }),
    prisma.user.delete({ where: { id: agent.id } })
  ]);
  await autoAssignSupportQueue(null, {
    source: "admin",
    assignedByUserId: session.id,
    reason: "support_agent_deleted_queue_reassignment"
  });
  await writeAuditLog({
    userId: session.id,
    action: "SUPPORT_AGENT_DELETED",
    entity: "User",
    entityId: agent.id,
    metadata: { email: agent.email, name: agent.name }
  });

  return NextResponse.json({ deletedId: agent.id });
}
