import { prisma } from "@/lib/prisma";
import { createUpiQrImageDataUrl } from "@/services/upi";

export type PublicOrderReceipt = {
  orderNumber: string;
  invoiceNumber: string;
  invoiceIssuedAt: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: "UPI" | "CASH";
  paymentProvider: "RAZORPAY" | "CASHFREE" | "UPI" | "CASH" | null;
  paymentId: string | null;
  paymentUrl: string | null;
  paymentQrImageUrl: string | null;
  paymentExpiresAt: string | null;
  paymentExpired: boolean;
  paymentFailureReason: string | null;
  paymentFailedAt: string | null;
  paidAt: string | null;
  orderType: string;
  subtotal: number;
  serviceFee: number;
  discountAmount: number;
  taxableAmount: number;
  gstRateBps: number;
  gstAmount: number;
  totalAmount: number;
  notes: string | null;
  business: {
    name: string;
    type: string;
    slug: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  customer: {
    name: string;
    email: string | null;
    address: string | null;
    whatsappUpdates: boolean;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
};

export function publicOrderPaymentFailureReason(input: {
  paymentExpired: boolean;
  paymentProvider: PublicOrderReceipt["paymentProvider"];
  paymentStatus: string | null;
  recordedFailureReason: string | null;
}) {
  if (input.recordedFailureReason) return input.recordedFailureReason;
  if (input.paymentExpired) {
    if (input.paymentProvider === "UPI") {
      return "The payment QR expired before PSHR Innovex verified the bank payment.";
    }
    if (input.paymentProvider === "CASHFREE") {
      return "The payment checkout expired before Cashfree received a verified payment.";
    }
    return "The payment request expired before the gateway confirmed it.";
  }
  if (input.paymentStatus === "FAILED") return "The payment could not be completed.";
  return null;
}

export async function getPublicOrderReceipt(publicToken: string): Promise<PublicOrderReceipt | null> {
  if (publicToken.length < 20 || publicToken.length > 100) return null;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      business: true,
      customer: true,
      items: true,
      payment: true
    }
  });

  if (!order) return null;

  const paymentStatus = order.payment?.status ?? null;
  const paymentExpiresAt = order.payment?.paymentRequestExpiresAt ?? null;
  const paymentExpired = Boolean(
    paymentStatus === "PENDING" && paymentExpiresAt && paymentExpiresAt.getTime() <= Date.now()
  );
  const paymentRequestUrl =
    order.payment &&
    order.status !== "CANCELLED" &&
    order.payment.provider !== "CASH" &&
    order.payment.status === "PENDING" &&
    order.paymentStatus === "PENDING" &&
    !paymentExpired
      ? order.payment.paymentRequestUrl
      : null;
  const paymentQrImageUrl =
    paymentRequestUrl && order.payment?.provider === "UPI" && paymentRequestUrl.startsWith("upi://")
        ? await createUpiQrImageDataUrl(paymentRequestUrl).catch(() => null)
        : null;
  const paymentFailure = order.payment && order.payment.status === "FAILED"
    ? await prisma.auditLog.findFirst({
        where: {
          businessId: order.businessId,
          action: "ORDER_PAYMENT_FAILED",
          entity: "Payment",
          entityId: order.payment.id
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, metadata: true }
      })
    : null;
  const failureMetadata =
    paymentFailure?.metadata && typeof paymentFailure.metadata === "object" && !Array.isArray(paymentFailure.metadata)
      ? paymentFailure.metadata
      : null;
  const recordedFailureReason =
    failureMetadata && typeof failureMetadata.failureReason === "string" ? failureMetadata.failureReason : null;

  return {
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber ?? `INV-${order.orderNumber}`,
    invoiceIssuedAt: (order.invoiceIssuedAt ?? order.createdAt).toISOString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.payment?.provider === "CASH" ? "CASH" : "UPI",
    paymentProvider: order.payment?.provider ?? null,
    paymentId: order.payment?.cashfreePaymentId ?? order.payment?.manualVerificationReference ?? null,
    paymentUrl: paymentRequestUrl,
    paymentQrImageUrl,
    paymentExpiresAt: paymentExpiresAt?.toISOString() ?? null,
    paymentExpired,
    paymentFailureReason: publicOrderPaymentFailureReason({
      paymentExpired,
      paymentProvider: order.payment?.provider ?? null,
      paymentStatus,
      recordedFailureReason
    }),
    paymentFailedAt: paymentFailure?.createdAt.toISOString() ?? (paymentExpired ? paymentExpiresAt?.toISOString() ?? null : null),
    paidAt: order.payment?.paidAt?.toISOString() ?? null,
    orderType: order.orderType,
    subtotal: Number(order.subtotal),
    serviceFee: Number(order.deliveryFee),
    discountAmount: Number(order.discountAmount),
    taxableAmount: Number(order.taxableAmount),
    gstRateBps: order.gstRateBps,
    gstAmount: Number(order.gstAmount),
    totalAmount: Number(order.totalAmount),
    notes: order.notes,
    business: {
      name: order.business.name,
      type: order.business.businessType,
      slug: order.business.slug,
      phone: order.business.phone,
      email: order.business.email,
      address: order.business.address,
      city: order.business.city,
      state: order.business.state
    },
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      address: order.deliveryAddress ?? order.customer.address,
      whatsappUpdates: order.customer.whatsappOptIn
    },
    items: order.items.map((item) => ({
      id: item.id,
      name: item.itemName,
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.total)
    }))
  };
}
