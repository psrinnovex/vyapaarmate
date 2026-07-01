import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { sessionHomePath } from "@/lib/session-routing";
import type { SessionUser } from "@/lib/session";
import { smsVerificationEnabled } from "@/services/sms";

export async function requireCustomerSession(nextPath = "/user") {
  const session = await getSessionUser();

  if (!session) {
    redirect(`/login?type=user&next=${encodeURIComponent(nextPath)}`);
  }

  if (session.role !== "CUSTOMER") {
    redirect(sessionHomePath(session));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id, role: "CUSTOMER" },
    select: { id: true, emailVerifiedAt: true, phoneVerifiedAt: true }
  });
  const phoneVerificationRequired = smsVerificationEnabled();
  if (!user) {
    redirect(`/login?type=user&next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.emailVerifiedAt || (phoneVerificationRequired && !user.phoneVerifiedAt)) {
    const smsParam = phoneVerificationRequired ? "&sms=1" : "";
    redirect(`/register?type=user&verification=${encodeURIComponent(user.id)}${smsParam}&next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}

export async function getCustomerPortalUser(session: Pick<SessionUser, "id" | "role">) {
  const user = await prisma.user.findUnique({
    where: { id: session.id, role: session.role },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    redirect("/login?type=user&next=/user");
  }

  const phoneVerificationRequired = smsVerificationEnabled();
  if (!user.emailVerifiedAt || (phoneVerificationRequired && !user.phoneVerifiedAt)) {
    const smsParam = phoneVerificationRequired ? "&sms=1" : "";
    redirect(`/register?type=user&verification=${encodeURIComponent(user.id)}${smsParam}`);
  }

  return user;
}

type CustomerPortalUser = Awaited<ReturnType<typeof getCustomerPortalUser>>;

function customerContactFilters(user: Pick<CustomerPortalUser, "email" | "phone" | "phoneVerifiedAt">): Prisma.CustomerWhereInput[] {
  const filters: Prisma.CustomerWhereInput[] = [
    { email: { equals: user.email, mode: Prisma.QueryMode.insensitive } }
  ];

  if (user.phone && user.phoneVerifiedAt) {
    filters.push({ phone: user.phone });
  }

  return filters;
}

export async function getCustomerPortalOrders(user: CustomerPortalUser) {
  const orders = await prisma.order.findMany({
    where: {
      customer: {
        is: {
          OR: customerContactFilters(user)
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      publicToken: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      subtotal: true,
      deliveryFee: true,
      totalAmount: true,
      orderType: true,
      deliveryAddress: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      business: {
        select: {
          name: true,
          slug: true,
          city: true,
          state: true,
          businessType: true
        }
      },
      customer: {
        select: {
          name: true,
          phone: true,
          email: true
        }
      },
      items: {
        orderBy: { itemName: "asc" },
        select: {
          itemName: true,
          quantity: true,
          total: true
        }
      },
      payment: {
        select: {
          provider: true,
          status: true,
          paidAt: true
        }
      }
    }
  });

  return orders.map((order) => ({
    ...order,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      ...item,
      total: Number(item.total)
    }))
  }));
}

export async function getCustomerPortalBusinessProfiles(user: CustomerPortalUser) {
  const customers = await prisma.customer.findMany({
    where: { OR: customerContactFilters(user) },
    orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      whatsappOptIn: true,
      marketingOptIn: true,
      totalOrders: true,
      totalSpent: true,
      lastOrderAt: true,
      createdAt: true,
      business: {
        select: {
          name: true,
          slug: true,
          city: true,
          state: true,
          businessType: true
        }
      }
    }
  });

  return customers.map((customer) => ({
    ...customer,
    totalSpent: Number(customer.totalSpent)
  }));
}
