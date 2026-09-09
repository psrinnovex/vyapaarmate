import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/api-session";
import { isVerifiedCustomerAccount } from "@/lib/customer-account-policy";
import { prisma } from "@/lib/prisma";
import { apiForbidden, apiUnauthorized } from "@/lib/security/api-response";
import { smsVerificationEnabled } from "@/services/sms";

const verifiedCustomerAccountSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  passwordHash: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  updatedAt: true
});

type VerifiedCustomerAccount = Prisma.UserGetPayload<{
  select: typeof verifiedCustomerAccountSelect;
}>;

export async function requireVerifiedCustomerAccount() {
  const session = await getSessionUser();
  if (!session) {
    return { response: apiUnauthorized() } as const;
  }
  if (session.role !== "CUSTOMER") {
    return { response: apiForbidden("This action is available only to customer accounts.") } as const;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id, role: "CUSTOMER" },
    select: verifiedCustomerAccountSelect
  });

  if (!user) {
    return { response: apiUnauthorized() } as const;
  }
  if (!isVerifiedCustomerAccount(user, smsVerificationEnabled())) {
    return {
      response: apiForbidden("Complete the required account verification before using this action.")
    } as const;
  }

  return { user } as const;
}

function customerContactFilters(
  user: Pick<VerifiedCustomerAccount, "email" | "phone" | "phoneVerifiedAt">
): Prisma.CustomerWhereInput[] {
  const filters: Prisma.CustomerWhereInput[] = [
    { email: { equals: user.email, mode: Prisma.QueryMode.insensitive } }
  ];

  if (user.phone && user.phoneVerifiedAt) {
    filters.push({ phone: user.phone });
  }

  return filters;
}

export async function getCustomerAccountExportData(user: VerifiedCustomerAccount) {
  const [customerRecords, supportTickets] = await Promise.all([
    prisma.customer.findMany({
      where: { OR: customerContactFilters(user) },
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
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
        },
        orders: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            publicToken: true,
            invoiceNumber: true,
            invoiceIssuedAt: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            subtotal: true,
            deliveryFee: true,
            discountAmount: true,
            taxableAmount: true,
            gstRateBps: true,
            gstAmount: true,
            couponCode: true,
            totalAmount: true,
            orderType: true,
            deliveryAddress: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            items: {
              orderBy: { itemName: "asc" },
              select: {
                itemName: true,
                quantity: true,
                price: true,
                total: true
              }
            },
            appointment: {
              select: {
                startsAt: true,
                endsAt: true,
                timezone: true,
                status: true,
                source: true,
                confirmedAt: true,
                cancelledAt: true,
                completedAt: true,
                cancellationReason: true,
                provider: { select: { name: true, title: true } }
              }
            },
            payment: {
              select: {
                provider: true,
                amount: true,
                status: true,
                paidAt: true,
                createdAt: true
              }
            }
          }
        }
      }
    }),
    prisma.supportTicket.findMany({
      where: { requesterUserId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        subject: true,
        description: true,
        priority: true,
        status: true,
        source: true,
        portal: true,
        path: true,
        orderReference: true,
        paymentReference: true,
        lastMessage: true,
        lastMessageAt: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            sender: true,
            body: true,
            createdAt: true
          }
        }
      }
    })
  ]);

  return {
    customerRecords: customerRecords.map((customer) => ({
      ...customer,
      totalSpent: Number(customer.totalSpent),
      orders: customer.orders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        discountAmount: Number(order.discountAmount),
        taxableAmount: Number(order.taxableAmount),
        gstAmount: Number(order.gstAmount),
        totalAmount: Number(order.totalAmount),
        items: order.items.map((item) => ({
          ...item,
          price: Number(item.price),
          total: Number(item.total)
        })),
        payment: order.payment
          ? {
              ...order.payment,
              amount: Number(order.payment.amount)
            }
          : null
      }))
    })),
    supportTickets
  };
}
