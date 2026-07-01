import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { adminPlatformUpiVerificationSchema } from "@/lib/validations";
import { completePlatformUpiOrderPayment } from "@/services/business-wallet";
import { sendOrderWhatsappUpdate } from "@/services/order-whatsapp";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = adminPlatformUpiVerificationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { paymentId } = await context.params;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { orderNumber: true, status: true } } }
  });
  if (!payment || payment.provider !== "UPI") {
    return NextResponse.json({ error: "Platform UPI payment not found" }, { status: 404 });
  }
  if (payment.order.status === "CANCELLED") {
    return NextResponse.json({ error: "Cancelled orders cannot be verified as paid." }, { status: 409 });
  }

  const reference = parsed.data.reference.toUpperCase();
  const subscriptionWithReference = await prisma.subscription.findUnique({
    where: { manualVerificationReference: reference },
    select: { id: true }
  });
  if (subscriptionWithReference) {
    return NextResponse.json({ error: "This bank UTR is already attached to a subscription payment." }, { status: 409 });
  }

  let result;
  try {
    result = await completePlatformUpiOrderPayment({
      paymentId: payment.id,
      verifiedByUserId: session.id,
      reference
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This bank UTR is already attached to another payment." }, { status: 409 });
    }
    throw error;
  }
  if (!result.walletCredited) {
    return NextResponse.json(
      {
        error: result.reason === "already_completed"
          ? "Payment is already completed."
          : result.reason === "reference_used"
            ? "This bank UTR is already attached to another payment."
            : result.reason === "order_cancelled"
              ? "Cancelled orders cannot be verified as paid."
            : "Payment could not be verified."
      },
      { status: 409 }
    );
  }

  await writeAuditLog({
    userId: session.id,
    businessId: payment.businessId,
    action: "PLATFORM_UPI_PAYMENT_VERIFIED",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      amount: Number(payment.amount),
      reference,
      walletCredited: result.walletCredited
    }
  });

  const whatsapp = await sendOrderWhatsappUpdate({ businessId: payment.businessId, orderId: payment.orderId });
  return NextResponse.json({ completed: true, walletCredited: true, whatsapp });
}
