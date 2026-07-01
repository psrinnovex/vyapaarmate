import type { PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBusinessPayoutEmail } from "@/services/business-payout-email";
import { sendPaidOrderInvoiceEmail } from "@/services/order-invoice-email";
import {
  cashfreeRefundIdForPayment,
  createCashfreeOrderRefund,
  terminateCashfreeOrder
} from "@/services/cashfree";
import {
  cashfreeAutoPayoutMinAmount,
  cashfreePayoutBeneficiaryId,
  cashfreePayoutProvider,
  cashfreePayoutTransferId,
  createCashfreePayoutTransfer,
  ensureCashfreePayoutBeneficiary,
  getCashfreePayoutTransferStatus,
  isCashfreeAutoPayoutEnabled,
  isCashfreePayoutFailure,
  isCashfreePayoutSuccess,
  isCashfreePayoutsConfigured,
  type CashfreePayoutDestination,
  type CashfreePayoutTransferResult,
  type CashfreePayoutWebhookEvent
} from "@/services/cashfree-payouts";
import type { GatewayProvider } from "@/services/payment-verification";

type DbClient = typeof prisma | Prisma.TransactionClient;
type RefundWalletAction = "none" | "credit_cancelled" | "settled_refund_debit_recorded";

type WalletAmounts = {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
};

type CashfreeProviderRefund = Awaited<ReturnType<typeof createCashfreeOrderRefund>>;
type CashfreeProviderTermination = Awaited<ReturnType<typeof terminateCashfreeOrder>>;
type PayoutWalletAction = "paid" | "failed" | "processing" | "skipped";

const autoPayoutBusinessSelect = {
  id: true,
  name: true,
  ownerName: true,
  phone: true,
  email: true,
  isActive: true,
  isVerified: true,
  kycStatus: true,
  payoutMethod: true,
  payoutUpiId: true,
  payoutUpiName: true,
  payoutAccountHolderName: true,
  payoutBankName: true,
  payoutBankAccountNumber: true,
  payoutBankIfsc: true,
  cashfreePayoutBeneficiaryId: true
} satisfies Prisma.BusinessSelect;

type AutoPayoutBusiness = Prisma.BusinessGetPayload<{ select: typeof autoPayoutBusinessSelect }>;

function cleanNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const IST_OFFSET_MINUTES = 330;
const DAILY_PAYOUT_BATCH_HOUR_IST = 9;

function providerSettlementDelayDays() {
  return Math.max(0, Math.min(30, cleanNumber(process.env.PAYMENT_PROVIDER_SETTLEMENT_DAYS, 0)));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function nextPayoutBatchAt(date: Date) {
  const istOffsetMs = IST_OFFSET_MINUTES * 60 * 1000;
  const dateInIst = new Date(date.getTime() + istOffsetMs);
  const batchUtcMs =
    Date.UTC(
      dateInIst.getUTCFullYear(),
      dateInIst.getUTCMonth(),
      dateInIst.getUTCDate(),
      DAILY_PAYOUT_BATCH_HOUR_IST,
      0,
      0,
      0
    ) - istOffsetMs;
  const sameDayBatch = new Date(batchUtcMs);

  if (sameDayBatch.getTime() >= date.getTime()) return sameDayBatch;
  return new Date(sameDayBatch.getTime() + 24 * 60 * 60 * 1000);
}

export function walletPayoutEligibleAt(paidAt: Date) {
  return nextPayoutBatchAt(addDays(paidAt, providerSettlementDelayDays()));
}

function metadataPaidAt(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const paidAt = (metadata as Record<string, unknown>).paidAt;
  if (typeof paidAt !== "string") return null;
  const parsed = new Date(paidAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function walletEntryPayoutEligibleAt(entry: {
  providerSettlementEligibleAt: Date | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
}) {
  const currentPolicyEligibleAt = walletPayoutEligibleAt(metadataPaidAt(entry.metadata) ?? entry.createdAt);
  if (!entry.providerSettlementEligibleAt) return currentPolicyEligibleAt;
  return entry.providerSettlementEligibleAt.getTime() <= currentPolicyEligibleAt.getTime()
    ? entry.providerSettlementEligibleAt
    : currentPolicyEligibleAt;
}

function moneyFromPaise(paise: number) {
  return Math.round(paise) / 100;
}

function amountToPaise(amount: Prisma.Decimal | number) {
  return Math.round(Number(amount) * 100);
}

function jsonMetadata(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  } catch {
    return { value: String(value) };
  }
}

function providerResultUpdateData(
  result: Pick<CashfreePayoutTransferResult, "cfTransferId" | "status" | "statusCode" | "statusDescription" | "utr" | "acknowledged" | "raw">
) {
  return {
    providerReferenceId: result.cfTransferId ?? undefined,
    providerStatus: result.status ?? undefined,
    providerStatusCode: result.statusCode ?? undefined,
    providerStatusDescription: result.statusDescription ?? undefined,
    providerUtr: result.utr ?? undefined,
    providerAcknowledged: result.acknowledged,
    reference: result.utr ?? result.cfTransferId ?? undefined,
    providerUpdatedAt: new Date(),
    providerMetadata: jsonMetadata(result.raw)
  } satisfies Prisma.BusinessPayoutUpdateInput;
}

function businessPayoutDestination(business: AutoPayoutBusiness): CashfreePayoutDestination | null {
  const beneficiaryName =
    business.payoutMethod === "UPI"
      ? business.payoutUpiName?.trim() || business.ownerName || business.name
      : business.payoutAccountHolderName?.trim() || business.ownerName || business.name;

  if (business.payoutMethod === "UPI") {
    if (!business.payoutUpiId?.trim()) return null;
    return {
      method: "UPI",
      beneficiaryName,
      phone: business.phone,
      email: business.email,
      upiId: business.payoutUpiId
    };
  }

  if (!business.payoutBankAccountNumber?.trim() || !business.payoutBankIfsc?.trim()) return null;
  return {
    method: "BANK_TRANSFER",
    beneficiaryName,
    phone: business.phone,
    email: business.email,
    bankAccountNumber: business.payoutBankAccountNumber,
    bankIfsc: business.payoutBankIfsc
  };
}

function businessCanReceiveAutomaticPayout(business: AutoPayoutBusiness) {
  return business.isActive && business.isVerified && business.kycStatus === "APPROVED";
}

function providerRequestMayHaveCreatedTransfer(error: unknown) {
  if (!(error instanceof Error)) return true;
  const status = Number(error.name.replace("CashfreePayouts", ""));
  if (Number.isFinite(status) && (status >= 500 || status === 409 || status === 429)) return true;
  return error.name === "AbortError" || error.name === "TimeoutError" || error instanceof TypeError;
}

async function sendBusinessPayoutEmailSafely(payoutId: string) {
  try {
    return await sendBusinessPayoutEmail(payoutId, { actorUserId: null });
  } catch (error) {
    console.error("Automatic business payout email failed", error);
    return { status: "failed" as const, to: "", reason: error instanceof Error ? error.message : "Payout email failed." };
  }
}

async function sendInvoiceEmailAfterPayment(orderId: string) {
  try {
    return await sendPaidOrderInvoiceEmail(orderId);
  } catch (error) {
    console.error("Paid invoice email failed", error);
    return { status: "failed" as const, reason: error instanceof Error ? error.message : "Invoice email failed." };
  }
}

export function walletAmounts(amount: number, platformFeeBps: number): WalletAmounts {
  const grossPaise = Math.max(0, Math.round(amount * 100));
  const feeBps = Math.max(0, Math.min(5000, platformFeeBps));
  const platformFeePaise = Math.min(grossPaise, Math.floor((grossPaise * feeBps) / 10_000));
  const netPaise = grossPaise - platformFeePaise;

  return {
    grossAmount: moneyFromPaise(grossPaise),
    platformFee: moneyFromPaise(platformFeePaise),
    netAmount: moneyFromPaise(netPaise)
  };
}

export async function creditBusinessWalletForPayment(paymentId: string, client: DbClient = prisma) {
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    include: {
      business: { select: { id: true, platformFeeBps: true } },
      order: { select: { id: true, orderNumber: true, publicToken: true } }
    }
  });

  if (!payment || payment.status !== "COMPLETED") return null;
  if (payment.provider !== "CASHFREE") return null;
  if (!payment.cashfreePaymentId) return null;

  const paidAt = payment.paidAt ?? new Date();
  const amounts = walletAmounts(Number(payment.amount), payment.business.platformFeeBps);
  const eligibleAt = walletPayoutEligibleAt(paidAt);

  return client.businessWalletEntry.upsert({
    where: { paymentId: payment.id },
    update: {},
    create: {
      businessId: payment.business.id,
      paymentId: payment.id,
      type: "ORDER_PAYMENT_CREDIT",
      status: "PENDING_PROVIDER_SETTLEMENT",
      provider: payment.provider,
      amount: amounts.netAmount,
      grossAmount: amounts.grossAmount,
      platformFee: amounts.platformFee,
      description: `Customer payment for ${payment.order.orderNumber}`,
      providerSettlementEligibleAt: eligibleAt,
      metadata: {
        orderId: payment.order.id,
        orderNumber: payment.order.orderNumber,
        publicToken: payment.order.publicToken,
        paymentProvider: payment.provider,
        cashfreeOrderId: payment.cashfreeOrderId,
        cashfreePaymentId: payment.cashfreePaymentId,
        paidAt: paidAt.toISOString()
      }
    }
  });
}

export type CompleteGatewayPaymentInput = {
  paymentId: string;
  provider: GatewayProvider;
  providerPaymentId: string;
  providerRequestId: string;
  cashfreeCfOrderId?: string | null;
  providerStatus?: string | null;
  paidAt?: Date;
};

async function refundCashfreeOrderPayment(input: {
  paymentId: string;
  cashfreeOrderId: string | null;
  amount: number;
  note: string;
}) {
  if (!input.cashfreeOrderId) {
    throw new Error("Cashfree payment cannot be refunded because the gateway order ID is missing.");
  }

  return createCashfreeOrderRefund({
    orderId: input.cashfreeOrderId,
    amount: input.amount,
    refundId: cashfreeRefundIdForPayment(input.paymentId),
    note: input.note
  });
}

export async function completeGatewayOrderPayment(input: CompleteGatewayPaymentInput) {
  const paidAt = input.paidAt ?? new Date();
  let providerRefund: CashfreeProviderRefund | null = null;

  const refundCandidate = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      order: { select: { status: true } }
    }
  });

  if (
    refundCandidate &&
    refundCandidate.status !== "REFUNDED" &&
    refundCandidate.order.status === "CANCELLED"
  ) {
    try {
      providerRefund = await refundCashfreeOrderPayment({
        paymentId: refundCandidate.id,
        cashfreeOrderId: input.providerRequestId,
        amount: Number(refundCandidate.amount),
        note: "Order cancelled after payment"
      });
    } catch (error) {
      console.error("Cashfree refund for cancelled order failed", error);
      return {
        updated: false,
        walletCredited: false,
        reason: "refund_failed" as const
      };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, orderId: true, status: true, order: { select: { status: true } } }
    });
    if (!existing || existing.status === "REFUNDED") {
      return { updated: false, walletCredited: false };
    }
    if (existing.order.status === "CANCELLED") {
      const payment = await tx.payment.findUnique({
        where: { id: existing.id },
        include: {
          order: { select: { id: true, orderNumber: true, publicToken: true } },
          walletEntry: true
        }
      });
      if (!payment || payment.status === "REFUNDED") {
        return { updated: false, walletCredited: false, reason: "order_cancelled" as const };
      }

      const claimed = await tx.payment.updateMany({
        where: { id: existing.id, status: { in: ["PENDING", "FAILED", "COMPLETED"] } },
        data: {
          provider: "CASHFREE",
          razorpayPaymentLinkId: null,
          razorpayPaymentId: null,
          cashfreeOrderId: input.providerRequestId,
          cashfreeCfOrderId: input.cashfreeCfOrderId ?? null,
          cashfreePaymentId: input.providerPaymentId,
          cashfreeOrderStatus: input.providerStatus ?? "PAID",
          status: "REFUNDED",
          paidAt
        }
      });
      if (claimed.count === 0) {
        return { updated: false, walletCredited: false, reason: "order_cancelled" as const };
      }

      const walletAction = await reverseWalletCreditForRefund({
        tx,
        payment,
        refundedAt: paidAt,
        refundedByUserId: null
      });
      await tx.order.update({
        where: { id: existing.orderId },
        data: { paymentStatus: "REFUNDED" }
      });

      return {
        updated: true,
        walletCredited: false,
        refunded: true as const,
        walletAction,
        providerRefund,
        orderId: existing.orderId
      };
    }

    if (existing.status === "COMPLETED") {
      const walletEntry = await creditBusinessWalletForPayment(existing.id, tx);
      return { updated: false, walletCredited: Boolean(walletEntry) };
    }

    const claimed = await tx.payment.updateMany({
      where: {
        id: existing.id,
        status: { in: ["PENDING", "FAILED"] }
      },
      data: {
        provider: "CASHFREE",
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        cashfreeOrderId: input.providerRequestId,
        cashfreeCfOrderId: input.cashfreeCfOrderId ?? null,
        cashfreePaymentId: input.providerPaymentId,
        cashfreeOrderStatus: input.providerStatus ?? "PAID",
        status: "COMPLETED",
        paidAt
      }
    });
    if (claimed.count === 0) {
      const walletEntry = await creditBusinessWalletForPayment(existing.id, tx);
      return { updated: false, walletCredited: Boolean(walletEntry) };
    }

    await tx.order.update({
      where: { id: existing.orderId },
      data: { paymentStatus: "COMPLETED" }
    });
    const walletEntry = await creditBusinessWalletForPayment(existing.id, tx);
    if (!walletEntry) {
      throw new Error("Completed gateway payment could not be credited to the business wallet.");
    }

    return { updated: true, walletCredited: true, orderId: existing.orderId };
  });

  if (result.updated && "orderId" in result && typeof result.orderId === "string") {
    return { ...result, invoiceEmail: await sendInvoiceEmailAfterPayment(result.orderId) };
  }

  return result;
}

export async function completePlatformUpiOrderPayment(input: {
  paymentId: string;
  verifiedByUserId: string;
  reference: string;
  paidAt?: Date;
}) {
  const paidAt = input.paidAt ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        business: { select: { id: true, platformFeeBps: true } },
        order: { select: { id: true, orderNumber: true, publicToken: true, status: true } },
        walletEntry: true
      }
    });

    if (!payment || payment.provider !== "UPI" || payment.status === "REFUNDED") {
      return { updated: false, walletCredited: false, reason: "not_found" as const };
    }
    if (payment.status === "COMPLETED") {
      return { updated: false, walletCredited: Boolean(payment.walletEntry), reason: "already_completed" as const };
    }
    if (payment.order.status === "CANCELLED") {
      return { updated: false, walletCredited: false, reason: "order_cancelled" as const };
    }

    const referenceUsed = await tx.payment.findFirst({
      where: {
        manualVerificationReference: input.reference,
        id: { not: payment.id }
      },
      select: { id: true }
    });
    if (referenceUsed) {
      return { updated: false, walletCredited: false, reason: "reference_used" as const };
    }

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, provider: "UPI", status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "COMPLETED",
        paidAt,
        manualVerificationReference: input.reference,
        manualVerifiedByUserId: input.verifiedByUserId,
        manualVerifiedAt: paidAt
      }
    });
    if (claimed.count === 0) {
      return { updated: false, walletCredited: false, reason: "not_pending" as const };
    }

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "COMPLETED" }
    });

    const amounts = walletAmounts(Number(payment.amount), payment.business.platformFeeBps);
    await tx.businessWalletEntry.upsert({
      where: { paymentId: payment.id },
      update: {},
      create: {
        businessId: payment.business.id,
        paymentId: payment.id,
        type: "ORDER_PAYMENT_CREDIT",
        status: "AVAILABLE",
        provider: "UPI",
        amount: amounts.netAmount,
        grossAmount: amounts.grossAmount,
        platformFee: amounts.platformFee,
        description: `PSHR UPI payment for ${payment.order.orderNumber}`,
        providerSettlementEligibleAt: paidAt,
        providerSettledAt: paidAt,
        metadata: {
          orderId: payment.order.id,
          orderNumber: payment.order.orderNumber,
          publicToken: payment.order.publicToken,
          paymentProvider: "UPI",
          verificationReference: input.reference,
          verifiedByUserId: input.verifiedByUserId,
          verifiedAt: paidAt.toISOString()
        }
      }
    });

    return { updated: true, walletCredited: true, reason: "completed" as const, orderId: payment.orderId };
  });

  if (result.updated && "orderId" in result && typeof result.orderId === "string") {
    return { ...result, invoiceEmail: await sendInvoiceEmailAfterPayment(result.orderId) };
  }

  return result;
}

export async function failGatewayOrderPayment(input: {
  paymentId: string;
  provider: GatewayProvider;
  providerPaymentId?: string | null;
  providerRequestId: string;
  cashfreeCfOrderId?: string | null;
  providerStatus?: string | null;
}) {
  const failedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, orderId: true }
    });
    if (!payment) return { updated: false };

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, provider: input.provider, status: "PENDING" },
      data: {
        cashfreeOrderId: input.providerRequestId,
        cashfreeCfOrderId: input.cashfreeCfOrderId ?? undefined,
        cashfreeOrderStatus: input.providerStatus ?? "FAILED",
        ...(input.providerPaymentId ? { cashfreePaymentId: input.providerPaymentId } : {}),
        status: "FAILED",
        paidAt: null,
        cashfreePaymentSessionId: null,
        paymentRequestUrl: null,
        paymentRequestExpiresAt: failedAt,
        paymentReminderSentAt: null
      }
    });
    if (claimed.count === 0) return { updated: false };

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "FAILED" }
    });
    return { updated: true };
  });
}

async function reverseWalletCreditForRefund(input: {
  tx: Prisma.TransactionClient;
  payment: Prisma.PaymentGetPayload<{
    include: {
      order: { select: { id: true; orderNumber: true; publicToken: true } };
      walletEntry: true;
    };
  }>;
  refundedAt: Date;
  refundedByUserId: string | null;
}): Promise<RefundWalletAction> {
  const walletEntry = input.payment.walletEntry;
  if (!walletEntry || walletEntry.type !== "ORDER_PAYMENT_CREDIT") return "none";
  if (walletEntry.status === "CANCELLED") return "none";

  if (walletEntry.status === "SETTLED" || walletEntry.status === "PROCESSING_PAYOUT") {
    await input.tx.businessWalletEntry.create({
      data: {
        businessId: input.payment.businessId,
        type: "REFUND_DEBIT",
        status: "SETTLED",
        provider: input.payment.provider,
        amount: -Number(walletEntry.amount),
        grossAmount: -Number(walletEntry.grossAmount),
        platformFee: -Number(walletEntry.platformFee),
        description: `Refund for ${input.payment.order.orderNumber}`,
        settledAt: input.refundedAt,
        metadata: {
          orderId: input.payment.order.id,
          orderNumber: input.payment.order.orderNumber,
          publicToken: input.payment.order.publicToken,
          paymentId: input.payment.id,
          originalWalletEntryId: walletEntry.id,
          originalWalletStatus: walletEntry.status,
          refundedByUserId: input.refundedByUserId,
          refundedAt: input.refundedAt.toISOString(),
          reason: "business_cancelled_order"
        }
      }
    });
    return "settled_refund_debit_recorded";
  }

  await input.tx.businessWalletEntry.update({
    where: { id: walletEntry.id },
    data: {
      status: "CANCELLED",
      metadata: {
        orderId: input.payment.order.id,
        orderNumber: input.payment.order.orderNumber,
        publicToken: input.payment.order.publicToken,
        paymentId: input.payment.id,
        previousWalletStatus: walletEntry.status,
        refundedByUserId: input.refundedByUserId,
        refundedAt: input.refundedAt.toISOString(),
        reason: "business_cancelled_order"
      }
    }
  });
  return "credit_cancelled";
}

export async function cancelOrderPaymentForBusinessCancellation(input: {
  businessId: string;
  orderId: string;
  cancelledByUserId: string | null;
}) {
  const cancelledAt = new Date();
  const currentPayment = await prisma.payment.findFirst({
    where: { orderId: input.orderId, businessId: input.businessId },
    select: {
      id: true,
      provider: true,
      status: true,
      amount: true,
      cashfreeOrderId: true
    }
  });
  let providerRefund: CashfreeProviderRefund | null = null;
  let providerTermination: CashfreeProviderTermination | null = null;
  let providerTerminationError: string | null = null;

  if (currentPayment?.provider === "CASHFREE" && currentPayment.cashfreeOrderId) {
    if (currentPayment.status === "COMPLETED") {
      providerRefund = await refundCashfreeOrderPayment({
        paymentId: currentPayment.id,
        cashfreeOrderId: currentPayment.cashfreeOrderId,
        amount: Number(currentPayment.amount),
        note: "Order cancelled by business"
      });
    } else if (currentPayment.status === "PENDING" || currentPayment.status === "FAILED") {
      try {
        providerTermination = await terminateCashfreeOrder(currentPayment.cashfreeOrderId);
      } catch (error) {
        providerTerminationError = error instanceof Error ? error.message : "Cashfree order termination failed.";
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
      select: { id: true, status: true, paymentStatus: true, payment: true }
    });
    if (!order) return null;

    const payment = order.payment
      ? await tx.payment.findUnique({
          where: { id: order.payment.id },
          include: {
            order: { select: { id: true, orderNumber: true, publicToken: true } },
            walletEntry: true
          }
        })
      : null;

    if (!payment) {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
        select: { id: true, status: true, paymentStatus: true }
      });
      return {
        order: updated,
        paymentAction: "none" as const,
        walletAction: "none" as RefundWalletAction
      };
    }

    if (payment.status === "REFUNDED") {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", paymentStatus: "REFUNDED" },
        select: { id: true, status: true, paymentStatus: true }
      });
      return {
        order: updated,
        paymentId: payment.id,
        paymentAction: "already_refunded" as const,
        walletAction: "none" as RefundWalletAction
      };
    }

    if (payment.status === "COMPLETED") {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "COMPLETED" },
        data: { status: "REFUNDED" }
      });
      if (claimed.count === 0) {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
          select: { id: true, status: true, paymentStatus: true }
        });
        return {
          order: updated,
          paymentId: payment.id,
          paymentAction: "none" as const,
          walletAction: "none" as RefundWalletAction
        };
      }

      const walletAction = await reverseWalletCreditForRefund({
        tx,
        payment,
        refundedAt: cancelledAt,
        refundedByUserId: input.cancelledByUserId
      });
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", paymentStatus: "REFUNDED" },
        select: { id: true, status: true, paymentStatus: true }
      });
      return {
        order: updated,
        paymentId: payment.id,
        paymentAction: "refunded" as const,
        walletAction,
        providerRefund,
        refundedAt: cancelledAt
      };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        paidAt: null,
        cashfreeOrderStatus:
          payment.provider === "CASHFREE"
            ? providerTermination?.orderStatus ?? "CANCELLED_BY_BUSINESS"
            : payment.cashfreeOrderStatus,
        cashfreePaymentSessionId: null,
        paymentRequestUrl: null,
        paymentRequestExpiresAt: cancelledAt,
        paymentReminderSentAt: null
      }
    });
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", paymentStatus: "FAILED" },
      select: { id: true, status: true, paymentStatus: true }
    });

    return {
      order: updated,
      paymentId: payment.id,
      paymentAction: "cancelled_unpaid" as const,
      walletAction: "none" as RefundWalletAction,
      providerTermination,
      providerTerminationError
    };
  });
}

export async function creditMissingGatewayWalletEntries(limit = 100) {
  const payments = await prisma.payment.findMany({
    where: {
      provider: "CASHFREE",
      status: "COMPLETED",
      walletEntry: null
    },
    select: { id: true },
    orderBy: { paidAt: "asc" },
    take: limit
  });

  const results = await Promise.all(payments.map((payment) => creditBusinessWalletForPayment(payment.id)));
  return {
    checked: payments.length,
    credited: results.filter(Boolean).length
  };
}

export async function releaseProviderSettledWalletCredits(limit = 200) {
  const now = new Date();
  const entries = await prisma.businessWalletEntry.findMany({
    where: {
      type: "ORDER_PAYMENT_CREDIT",
      status: "PENDING_PROVIDER_SETTLEMENT"
    },
    select: { id: true, providerSettlementEligibleAt: true, createdAt: true, metadata: true },
    orderBy: [
      { providerSettlementEligibleAt: "asc" },
      { createdAt: "asc" }
    ],
    take: limit
  });

  if (entries.length === 0) return { checked: 0, released: 0 };
  const releasableEntryIds = entries
    .filter((entry) => walletEntryPayoutEligibleAt(entry).getTime() <= now.getTime())
    .map((entry) => entry.id);

  if (releasableEntryIds.length === 0) return { checked: entries.length, released: 0 };

  const released = await prisma.businessWalletEntry.updateMany({
    where: { id: { in: releasableEntryIds }, status: "PENDING_PROVIDER_SETTLEMENT" },
    data: {
      status: "AVAILABLE",
      providerSettledAt: now
    }
  });

  return {
    checked: entries.length,
    released: released.count
  };
}

export type BusinessWalletSummary = {
  grossCredited: number;
  platformFees: number;
  pendingProviderSettlement: number;
  availableForPayout: number;
  processingPayouts: number;
  paidOut: number;
  settledCredits: number;
};

export async function getBusinessWalletSummary(businessId: string): Promise<BusinessWalletSummary> {
  const entries = await prisma.businessWalletEntry.groupBy({
    by: ["type", "status"],
    where: {
      businessId,
      status: { not: "CANCELLED" },
      type: { in: ["ORDER_PAYMENT_CREDIT", "REFUND_DEBIT"] }
    },
    orderBy: [{ type: "asc" }, { status: "asc" }],
    _sum: { amount: true, grossAmount: true, platformFee: true }
  });
  const payouts = await prisma.businessPayout.aggregate({
    where: { businessId, status: "PAID" },
    _sum: { amount: true }
  });

  const statusAmount = (
    status: "PENDING_PROVIDER_SETTLEMENT" | "AVAILABLE" | "PROCESSING_PAYOUT" | "SETTLED" | "CANCELLED"
  ) =>
    entries
      .filter((entry) => entry.status === status)
      .reduce((sum, entry) => sum + Number(entry._sum?.amount ?? 0), 0);
  const activeCreditEntries = entries.filter((entry) => entry.type === "ORDER_PAYMENT_CREDIT");

  return {
    grossCredited: activeCreditEntries.reduce((sum, entry) => sum + Number(entry._sum?.grossAmount ?? 0), 0),
    platformFees: activeCreditEntries.reduce((sum, entry) => sum + Number(entry._sum?.platformFee ?? 0), 0),
    pendingProviderSettlement: statusAmount("PENDING_PROVIDER_SETTLEMENT"),
    availableForPayout: statusAmount("AVAILABLE"),
    processingPayouts: statusAmount("PROCESSING_PAYOUT"),
    settledCredits: statusAmount("SETTLED"),
    paidOut: Number(payouts._sum.amount ?? 0)
  };
}

export async function recordBusinessPayout(input: {
  businessId: string;
  method: string;
  reference?: string | null;
  notes?: string | null;
}) {
  const method = input.method.trim() || "BANK_TRANSFER";
  const reference = input.reference?.trim() || null;
  const notes = input.notes?.trim() || null;
  const paidAt = new Date();

  return prisma.$transaction(async (tx) => {
    const entries = await tx.businessWalletEntry.findMany({
      where: {
        businessId: input.businessId,
        type: "ORDER_PAYMENT_CREDIT",
        status: "AVAILABLE",
        payoutId: null
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true }
    });

    const total = moneyFromPaise(entries.reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0));
    if (entries.length === 0 || total <= 0) {
      throw new Error("This business has no available wallet balance to settle.");
    }

    const payout = await tx.businessPayout.create({
      data: {
        businessId: input.businessId,
        amount: total,
        status: "PAID",
        method,
        reference,
        notes,
        paidAt
      }
    });

    await tx.businessWalletEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) }, status: "AVAILABLE" },
      data: {
        status: "SETTLED",
        payoutId: payout.id,
        settledAt: paidAt
      }
    });

    await tx.businessWalletEntry.create({
      data: {
        businessId: input.businessId,
        payoutId: payout.id,
        type: "PAYOUT_DEBIT",
        status: "SETTLED",
        amount: -total,
        grossAmount: total,
        platformFee: 0,
        description: `Payout recorded via ${method}`,
        settledAt: paidAt,
        metadata: {
          method,
          reference,
          notes,
          settledCreditCount: entries.length
        }
      }
    });

    return {
      payout,
      settledCreditCount: entries.length
    };
  });
}

async function completeProcessingBusinessPayout(input: {
  payoutId: string;
  result: CashfreePayoutTransferResult;
}) {
  const paidAt = new Date();

  return prisma.$transaction(async (tx) => {
    const payout = await tx.businessPayout.findUnique({
      where: { id: input.payoutId },
      select: { id: true, businessId: true, amount: true, status: true }
    });
    if (!payout || payout.status !== "PROCESSING") return null;

    const updated = await tx.businessPayout.updateMany({
      where: { id: payout.id, status: "PROCESSING" },
      data: {
        status: "PAID",
        paidAt,
        providerCompletedAt: paidAt,
        ...providerResultUpdateData(input.result)
      }
    });
    if (updated.count === 0) return null;

    await tx.businessWalletEntry.updateMany({
      where: {
        payoutId: payout.id,
        type: "ORDER_PAYMENT_CREDIT",
        status: "PROCESSING_PAYOUT"
      },
      data: {
        status: "SETTLED",
        settledAt: paidAt
      }
    });

    const existingDebit = await tx.businessWalletEntry.findFirst({
      where: { payoutId: payout.id, type: "PAYOUT_DEBIT" },
      select: { id: true }
    });
    if (!existingDebit) {
      const amount = Number(payout.amount);
      await tx.businessWalletEntry.create({
        data: {
          businessId: payout.businessId,
          payoutId: payout.id,
          type: "PAYOUT_DEBIT",
          status: "SETTLED",
          amount: -amount,
          grossAmount: amount,
          platformFee: 0,
          description: "Automatic Cashfree payout",
          settledAt: paidAt,
          metadata: {
            provider: cashfreePayoutProvider(),
            transferId: input.result.transferId,
            cfTransferId: input.result.cfTransferId,
            utr: input.result.utr,
            settledAt: paidAt.toISOString()
          }
        }
      });
    }

    return { payoutId: payout.id, businessId: payout.businessId, amount: Number(payout.amount) };
  });
}

async function failProcessingBusinessPayout(input: {
  payoutId: string;
  result: Pick<CashfreePayoutTransferResult, "cfTransferId" | "status" | "statusCode" | "statusDescription" | "utr" | "acknowledged" | "raw">;
}) {
  const failedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const payout = await tx.businessPayout.findUnique({
      where: { id: input.payoutId },
      select: { id: true, businessId: true, status: true }
    });
    if (!payout || payout.status !== "PROCESSING") return null;

    const updated = await tx.businessPayout.updateMany({
      where: { id: payout.id, status: "PROCESSING" },
      data: {
        status: "FAILED",
        providerFailedAt: failedAt,
        ...providerResultUpdateData(input.result)
      }
    });
    if (updated.count === 0) return null;

    await tx.businessWalletEntry.updateMany({
      where: {
        payoutId: payout.id,
        type: "ORDER_PAYMENT_CREDIT",
        status: "PROCESSING_PAYOUT"
      },
      data: {
        status: "AVAILABLE",
        payoutId: null,
        settledAt: null
      }
    });

    return { payoutId: payout.id, businessId: payout.businessId };
  });
}

async function reversePaidBusinessPayoutAfterProviderFailure(input: {
  payoutId: string;
  result: Pick<CashfreePayoutTransferResult, "cfTransferId" | "status" | "statusCode" | "statusDescription" | "utr" | "acknowledged" | "raw">;
}) {
  const failedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const payout = await tx.businessPayout.findUnique({
      where: { id: input.payoutId },
      select: { id: true, businessId: true, status: true }
    });
    if (!payout || payout.status !== "PAID") return null;

    const updated = await tx.businessPayout.updateMany({
      where: { id: payout.id, status: "PAID" },
      data: {
        status: "FAILED",
        providerFailedAt: failedAt,
        ...providerResultUpdateData(input.result)
      }
    });
    if (updated.count === 0) return null;

    await tx.businessWalletEntry.updateMany({
      where: {
        payoutId: payout.id,
        type: "ORDER_PAYMENT_CREDIT",
        status: "SETTLED"
      },
      data: {
        status: "AVAILABLE",
        payoutId: null,
        settledAt: null
      }
    });

    await tx.businessWalletEntry.updateMany({
      where: {
        payoutId: payout.id,
        type: "PAYOUT_DEBIT",
        status: "SETTLED"
      },
      data: {
        status: "CANCELLED",
        metadata: {
          provider: cashfreePayoutProvider(),
          reason: "provider_failure_after_paid",
          failedAt: failedAt.toISOString(),
          providerStatus: input.result.status,
          providerStatusCode: input.result.statusCode,
          providerStatusDescription: input.result.statusDescription
        }
      }
    });

    return { payoutId: payout.id, businessId: payout.businessId };
  });
}

async function updateProcessingBusinessPayout(input: {
  payoutId: string;
  result: CashfreePayoutTransferResult;
}) {
  return prisma.businessPayout.updateMany({
    where: { id: input.payoutId, status: "PROCESSING" },
    data: providerResultUpdateData(input.result)
  });
}

async function applyCashfreePayoutTransferResult(input: {
  payoutId: string;
  result: CashfreePayoutTransferResult;
}) {
  if (isCashfreePayoutSuccess(input.result)) {
    const completed = await completeProcessingBusinessPayout(input);
    return {
      action: completed ? "paid" as const : "skipped" as const,
      payoutId: input.payoutId,
      payoutEmail: completed ? await sendBusinessPayoutEmailSafely(input.payoutId) : undefined
    };
  }

  if (isCashfreePayoutFailure(input.result)) {
    await failProcessingBusinessPayout(input);
    return { action: "failed" as const, payoutId: input.payoutId };
  }

  await updateProcessingBusinessPayout(input);
  return { action: "processing" as const, payoutId: input.payoutId };
}

async function createAutomaticCashfreePayoutForBusiness(business: AutoPayoutBusiness) {
  if (!businessCanReceiveAutomaticPayout(business)) {
    return { action: "skipped" as const, reason: "business_not_approved" as const, businessId: business.id };
  }

  const destination = businessPayoutDestination(business);
  if (!destination) {
    return { action: "skipped" as const, reason: "missing_payout_destination" as const, businessId: business.id };
  }

  const beneficiaryId = cashfreePayoutBeneficiaryId({ businessId: business.id, destination });
  const minimumAmount = cashfreeAutoPayoutMinAmount();
  const createdAt = new Date();

  const claimed = await prisma.$transaction(async (tx) => {
    const entries = await tx.businessWalletEntry.findMany({
      where: {
        businessId: business.id,
        type: "ORDER_PAYMENT_CREDIT",
        status: "AVAILABLE",
        payoutId: null
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true }
    });

    const total = moneyFromPaise(entries.reduce((sum, entry) => sum + amountToPaise(entry.amount), 0));
    if (entries.length === 0 || total < minimumAmount) {
      return null;
    }

    const payout = await tx.businessPayout.create({
      data: {
        businessId: business.id,
        amount: total,
        status: "PROCESSING",
        method: destination.method,
        autoInitiated: true,
        provider: cashfreePayoutProvider(),
        providerBeneficiaryId: beneficiaryId,
        providerStatus: "CREATED",
        providerRequestedAt: createdAt,
        notes: "Automatic payout after provider settlement"
      }
    });
    const transferId = cashfreePayoutTransferId(payout.id);
    await tx.businessPayout.update({
      where: { id: payout.id },
      data: { providerTransferId: transferId }
    });

    const locked = await tx.businessWalletEntry.updateMany({
      where: {
        id: { in: entries.map((entry) => entry.id) },
        status: "AVAILABLE",
        payoutId: null
      },
      data: {
        status: "PROCESSING_PAYOUT",
        payoutId: payout.id
      }
    });
    if (locked.count !== entries.length) {
      throw new Error("Wallet balance changed while preparing automatic payout. It will retry on the next job.");
    }

    return {
      payout: { ...payout, providerTransferId: transferId },
      amount: total,
      settledCreditCount: entries.length
    };
  });

  if (!claimed) {
    return { action: "skipped" as const, reason: "below_minimum_or_empty" as const, businessId: business.id };
  }

  let beneficiaryIdForTransfer = beneficiaryId;
  try {
    const beneficiary = await ensureCashfreePayoutBeneficiary({ businessId: business.id, destination });
    beneficiaryIdForTransfer = beneficiary.beneficiaryId;
    await prisma.business.update({
      where: { id: business.id },
      data: { cashfreePayoutBeneficiaryId: beneficiary.beneficiaryId }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cashfree payout beneficiary creation failed.";
    await failProcessingBusinessPayout({
      payoutId: claimed.payout.id,
      result: {
        cfTransferId: null,
        status: "FAILED",
        statusCode: "BENEFICIARY_FAILED",
        statusDescription: message,
        utr: null,
        acknowledged: false,
        raw: { error: message }
      }
    });

    return {
      action: "failed" as const,
      reason: "beneficiary_failed" as const,
      businessId: business.id,
      payoutId: claimed.payout.id,
      amount: claimed.amount,
      settledCreditCount: claimed.settledCreditCount,
      error: message
    };
  }

  try {
    const transfer = await createCashfreePayoutTransfer({
      payoutId: claimed.payout.id,
      amount: claimed.amount,
      beneficiaryId: beneficiaryIdForTransfer,
      destination,
      remarks: `Wallet payout for ${business.name}`
    });

    const applied = await applyCashfreePayoutTransferResult({
      payoutId: claimed.payout.id,
      result: transfer
    });

    return {
      action: applied.action,
      businessId: business.id,
      payoutId: claimed.payout.id,
      amount: claimed.amount,
      settledCreditCount: claimed.settledCreditCount,
      transferId: transfer.transferId,
      payoutEmail: applied.payoutEmail
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cashfree automatic payout failed.";
    if (providerRequestMayHaveCreatedTransfer(error)) {
      await prisma.businessPayout.update({
        where: { id: claimed.payout.id },
        data: {
          providerStatus: "REQUEST_UNKNOWN",
          providerStatusDescription: message,
          providerUpdatedAt: new Date(),
          providerMetadata: jsonMetadata({ error: message })
        }
      });

      return {
        action: "processing" as const,
        reason: "provider_request_unknown" as const,
        businessId: business.id,
        payoutId: claimed.payout.id,
        amount: claimed.amount,
        settledCreditCount: claimed.settledCreditCount,
        error: message
      };
    }

    await failProcessingBusinessPayout({
      payoutId: claimed.payout.id,
      result: {
        cfTransferId: null,
        status: "FAILED",
        statusCode: "REQUEST_FAILED",
        statusDescription: message,
        utr: null,
        acknowledged: false,
        raw: { error: message }
      }
    });

    return {
      action: "failed" as const,
      businessId: business.id,
      payoutId: claimed.payout.id,
      amount: claimed.amount,
      settledCreditCount: claimed.settledCreditCount,
      error: message
    };
  }
}

export async function processAutomaticCashfreePayouts(limit = 20) {
  if (!isCashfreeAutoPayoutEnabled() || !isCashfreePayoutsConfigured()) {
    return {
      enabled: isCashfreeAutoPayoutEnabled(),
      configured: isCashfreePayoutsConfigured(),
      checked: 0,
      attempted: 0,
      paid: 0,
      processing: 0,
      failed: 0,
      skipped: 0,
      results: [] as Array<{ action: PayoutWalletAction }>
    };
  }

  const minimumAmount = cashfreeAutoPayoutMinAmount();
  const groupedBalances = await prisma.businessWalletEntry.groupBy({
    by: ["businessId"],
    where: {
      type: "ORDER_PAYMENT_CREDIT",
      status: "AVAILABLE",
      payoutId: null
    },
    _sum: { amount: true },
    orderBy: { businessId: "asc" },
    take: Math.max(1, limit * 4)
  });

  const businessIds = groupedBalances
    .filter((item) => Number(item._sum.amount ?? 0) >= minimumAmount)
    .map((item) => item.businessId)
    .slice(0, limit);

  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: autoPayoutBusinessSelect
  });
  const byId = new Map(businesses.map((business) => [business.id, business]));
  const results: Array<{ action: PayoutWalletAction; [key: string]: unknown }> = [];

  for (const businessId of businessIds) {
    const business = byId.get(businessId);
    if (!business) continue;
    try {
      results.push(await createAutomaticCashfreePayoutForBusiness(business));
    } catch (error) {
      results.push({
        action: "failed" as const,
        businessId,
        error: error instanceof Error ? error.message : "Automatic payout failed."
      });
    }
  }

  return {
    enabled: true,
    configured: true,
    checked: groupedBalances.length,
    attempted: results.filter((result) => result.action !== "skipped").length,
    paid: results.filter((result) => result.action === "paid").length,
    processing: results.filter((result) => result.action === "processing").length,
    failed: results.filter((result) => result.action === "failed").length,
    skipped: results.filter((result) => result.action === "skipped").length,
    results
  };
}

export async function reconcileProcessingCashfreePayouts(limit = 50) {
  if (!isCashfreePayoutsConfigured()) {
    return { configured: false, checked: 0, paid: 0, processing: 0, failed: 0, errors: 0 };
  }

  const payouts = await prisma.businessPayout.findMany({
    where: {
      status: "PROCESSING",
      provider: cashfreePayoutProvider(),
      providerTransferId: { not: null }
    },
    orderBy: [{ providerRequestedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, providerTransferId: true }
  });

  const results: Array<{ action: PayoutWalletAction }> = [];
  let errors = 0;

  for (const payout of payouts) {
    if (!payout.providerTransferId) continue;
    try {
      const transfer = await getCashfreePayoutTransferStatus(payout.providerTransferId);
      results.push(await applyCashfreePayoutTransferResult({ payoutId: payout.id, result: transfer }));
    } catch (error) {
      errors += 1;
      await prisma.businessPayout.update({
        where: { id: payout.id },
        data: {
          providerStatusDescription: error instanceof Error ? error.message : "Cashfree payout reconciliation failed.",
          providerUpdatedAt: new Date()
        }
      });
    }
  }

  return {
    configured: true,
    checked: payouts.length,
    paid: results.filter((result) => result.action === "paid").length,
    processing: results.filter((result) => result.action === "processing").length,
    failed: results.filter((result) => result.action === "failed").length,
    errors
  };
}

function cashfreeWebhookTransferResult(
  payout: { providerTransferId: string | null },
  event: CashfreePayoutWebhookEvent
): CashfreePayoutTransferResult {
  return {
    transferId: event.transferId ?? payout.providerTransferId ?? "",
    cfTransferId: event.cfTransferId,
    status: event.status,
    statusCode: event.statusCode,
    statusDescription: event.statusDescription,
    utr: event.utr,
    acknowledged: event.acknowledged,
    raw: event.raw
  };
}

function cashfreePayoutWebhookSuccess(event: CashfreePayoutWebhookEvent) {
  return event.eventType?.toUpperCase() === "TRANSFER_SUCCESS" || isCashfreePayoutSuccess(event);
}

function cashfreePayoutWebhookFailure(event: CashfreePayoutWebhookEvent) {
  const eventType = event.eventType?.toUpperCase();
  return eventType === "TRANSFER_FAILED" || eventType === "TRANSFER_REVERSED" || eventType === "TRANSFER_REJECTED" || isCashfreePayoutFailure(event);
}

export async function applyCashfreePayoutWebhookEvent(event: CashfreePayoutWebhookEvent) {
  const filters = [
    event.transferId ? { providerTransferId: event.transferId } : null,
    event.cfTransferId ? { providerReferenceId: event.cfTransferId } : null
  ].filter(Boolean) as Prisma.BusinessPayoutWhereInput[];

  if (filters.length === 0) {
    return { matched: false, action: "skipped" as const, reason: "missing_transfer_id" as const };
  }

  const payout = await prisma.businessPayout.findFirst({
    where: {
      provider: cashfreePayoutProvider(),
      OR: filters
    },
    select: { id: true, providerTransferId: true, status: true }
  });

  if (!payout) {
    return { matched: false, action: "skipped" as const, reason: "payout_not_found" as const };
  }

  const result = cashfreeWebhookTransferResult(payout, event);
  if (cashfreePayoutWebhookSuccess(event)) {
    const completed = await completeProcessingBusinessPayout({ payoutId: payout.id, result });
    return {
      matched: true,
      action: completed ? "paid" as const : "skipped" as const,
      payoutId: payout.id,
      payoutEmail: completed ? await sendBusinessPayoutEmailSafely(payout.id) : undefined
    };
  }

  if (cashfreePayoutWebhookFailure(event)) {
    const failed = await failProcessingBusinessPayout({ payoutId: payout.id, result });
    if (!failed && payout.status === "PAID") {
      await reversePaidBusinessPayoutAfterProviderFailure({ payoutId: payout.id, result });
    }
    return { matched: true, action: "failed" as const, payoutId: payout.id };
  }

  await updateProcessingBusinessPayout({ payoutId: payout.id, result });
  return { matched: true, action: "processing" as const, payoutId: payout.id };
}

export function paymentProviderLabel(provider: PaymentProvider | null | undefined) {
  if (provider === "CASHFREE") return "Cashfree";
  if (provider === "UPI") return "PSHR Innovex UPI";
  if (provider === "CASH") return "Cash";
  return "Payment";
}
