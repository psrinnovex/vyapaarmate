import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { adminPlatformUpiVerificationSchema } from "@/lib/validations";
import { completeSubscriptionPayment } from "@/services/subscription-payments";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ subscriptionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = adminPlatformUpiVerificationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { subscriptionId } = await context.params;
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      businessId: true,
      plan: true,
      amount: true,
      paymentProvider: true,
      invoiceNumber: true
    }
  });
  if (!subscription || subscription.paymentProvider !== "UPI") {
    return NextResponse.json({ error: "PSHR Innovex UPI subscription payment not found" }, { status: 404 });
  }

  const reference = parsed.data.reference.toUpperCase();
  const orderPaymentWithReference = await prisma.payment.findUnique({
    where: { manualVerificationReference: reference },
    select: { id: true }
  });
  if (orderPaymentWithReference) {
    return NextResponse.json({ error: "This bank UTR is already attached to an order payment." }, { status: 409 });
  }

  let result;
  try {
    result = await completeSubscriptionPayment({
      subscriptionId: subscription.id,
      provider: "UPI",
      paidAt: new Date(),
      verifiedByUserId: session.id,
      verificationReference: reference
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This bank UTR is already attached to another subscription payment." }, { status: 409 });
    }
    throw error;
  }

  if (!result.updated) {
    return NextResponse.json({
      error: result.reason === "already_completed"
        ? "This subscription payment is already completed."
        : "This subscription payment could not be verified."
    }, { status: 409 });
  }

  await writeAuditLog({
    userId: session.id,
    businessId: subscription.businessId,
    action: "SUBSCRIPTION_UPI_PAYMENT_VERIFIED",
    entity: "Subscription",
    entityId: subscription.id,
    metadata: {
      invoiceNumber: subscription.invoiceNumber,
      plan: subscription.plan,
      amount: Number(subscription.amount),
      reference
    }
  });

  return NextResponse.json({ completed: true, subscriptionId: subscription.id });
}
