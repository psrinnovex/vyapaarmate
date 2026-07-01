import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { requireBusinessSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { getBusinessStaffPermissionSummary, getBusinessStaffRoleLabel } from "@/lib/business-staff-copy";
import { createPasswordResetToken, passwordResetUrl, sendStaffInviteEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { staffRoleUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

function staffRolePayload(role: Role, businessType: string) {
  return {
    role: getBusinessStaffRoleLabel(role, businessType),
    roleValue: role,
    permissions: getBusinessStaffPermissionSummary(role, businessType)
  };
}

async function findEditableStaff(userId: string, businessId: string) {
  return prisma.user.findFirst({
    where: { id: userId, businessId },
    select: { id: true, name: true, email: true, role: true }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:staff:manage");
  if (auth.response) return auth.response;
  const { session } = auth;

  const parsed = staffRoleUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId } = await context.params;
  if (userId === session.id) {
    return NextResponse.json({ error: "You cannot change your own role from Staff." }, { status: 400 });
  }

  const user = await findEditableStaff(userId, session.businessId);
  if (!user) {
    return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
  }
  if (user.role === "OWNER") {
    return NextResponse.json({ error: "Owner account roles cannot be changed from Staff." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role },
    select: { id: true, role: true }
  });
  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { businessType: true }
  });

  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "STAFF_ROLE_UPDATED",
    entity: "User",
    entityId: user.id,
    metadata: { name: user.name, previousRole: user.role, role: updated.role }
  });

  return NextResponse.json({ staff: { id: updated.id, ...staffRolePayload(updated.role, business?.businessType ?? "") } });
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:staff:manage");
  if (auth.response) return auth.response;
  const { session } = auth;

  const { userId } = await context.params;
  const user = await findEditableStaff(userId, session.businessId);
  if (!user) {
    return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
  }
  if (user.role === "OWNER") {
    return NextResponse.json({ error: "Owner accounts do not use staff invites." }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { name: true, businessType: true }
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const reset = await createPasswordResetToken(user.id);
  const inviteUrl = passwordResetUrl(reset.token, "business", "/dashboard");
  try {
    const delivery = await sendStaffInviteEmail({
      email: user.email,
      name: user.name,
      businessName: business.name,
      roleLabel: getBusinessStaffRoleLabel(user.role, business.businessType),
      inviteUrl
    });

    await writeAuditLog({
      userId: session.id,
      businessId: session.businessId,
      action: "STAFF_INVITE_RESENT",
      entity: "User",
      entityId: user.id,
      metadata: { name: user.name, role: user.role }
    });

    return NextResponse.json({
      invite: {
        status: delivery.status === "placeholder" ? "placeholder" : "sent",
        devInviteUrl: process.env.NODE_ENV !== "production" && delivery.status === "placeholder" ? inviteUrl : undefined
      }
    });
  } catch (error) {
    console.error("Staff invite email delivery failed", error);
    return NextResponse.json({ error: "Staff invite email could not be sent right now." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:staff:manage");
  if (auth.response) return auth.response;
  const { session } = auth;

  const { userId } = await context.params;
  if (userId === session.id) {
    return NextResponse.json({ error: "You cannot delete your own account from Staff." }, { status: 400 });
  }

  const user = await findEditableStaff(userId, session.businessId);

  if (!user) {
    return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
  }
  if (user.role === "OWNER") {
    return NextResponse.json({ error: "Owner accounts cannot be deleted from Staff." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: user.id } });
  await writeAuditLog({
    userId: session.id,
    businessId: session.businessId,
    action: "STAFF_DELETED",
    entity: "User",
    entityId: user.id,
    metadata: { name: user.name, role: user.role }
  });

  return NextResponse.json({ deletedId: user.id });
}
