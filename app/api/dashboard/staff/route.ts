import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { requireBusinessSession } from "@/lib/api-session";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createPasswordResetToken, passwordResetUrl, sendStaffInviteEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { getBusinessStaffPermissionSummary, getBusinessStaffRoleLabel } from "@/lib/business-staff-copy";
import { staffInviteSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

function mapStaff(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: Date;
}, businessType: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: getBusinessStaffRoleLabel(user.role, businessType),
    roleValue: user.role,
    permissions: getBusinessStaffPermissionSummary(user.role, businessType),
    status: "Active",
    createdAt: user.createdAt.toISOString()
  };
}

export async function GET() {
  const auth = await requireBusinessSession("business:staff:manage");
  if (auth.response) return auth.response;
  const { session } = auth;

  const staff = await prisma.user.findMany({
    where: { businessId: session.businessId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
  });
  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { businessType: true }
  });
  const businessType = business?.businessType ?? "";

  return NextResponse.json({ staff: staff.map((user) => mapStaff(user, businessType)) });
}

export async function POST(request: Request) {
  const auth = await requireBusinessSession("business:staff:manage");
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await request.json();
  const parsed = staffInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const passwordHash = await hashPassword(randomUUID());

  try {
    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: { name: true, businessType: true }
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const user = await prisma.user.create({
      data: {
        businessId: session.businessId,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        passwordHash,
        role: parsed.data.role
      },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    });

    const reset = await createPasswordResetToken(user.id);
    const inviteUrl = passwordResetUrl(reset.token, "business", "/dashboard");
    let invite:
      | { status: "sent" | "placeholder"; devInviteUrl?: string }
      | { status: "failed"; error: string };

    try {
      const delivery = await sendStaffInviteEmail({
        email: user.email,
        name: user.name,
        businessName: business.name,
        roleLabel: getBusinessStaffRoleLabel(user.role, business.businessType),
        inviteUrl
      });
      invite = {
        status: delivery.status === "placeholder" ? "placeholder" : "sent",
        devInviteUrl: process.env.NODE_ENV !== "production" && delivery.status === "placeholder" ? inviteUrl : undefined
      };
    } catch (error) {
      console.error("Staff invite email delivery failed", error);
      invite = {
        status: "failed",
        error: "Staff account was created, but the invite email could not be sent. Ask them to use Forgot password."
      };
    }

    await writeAuditLog({
      userId: session.id,
      businessId: session.businessId,
      action: "STAFF_INVITED",
      entity: "User",
      entityId: user.id,
      metadata: { role: user.role }
    });

    return NextResponse.json({ staff: mapStaff(user, business.businessType), invite }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A user with that email or phone already exists." }, { status: 409 });
    }
    throw error;
  }
}
