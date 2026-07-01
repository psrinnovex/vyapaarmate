import type { OrderTrackingStatus } from "@/lib/order-tracking";
import { isFoodBusinessType, isRetailBusinessType } from "@/lib/business-rules";

export type OrderAnimationKind =
  | "scanPay"
  | "paymentDone"
  | "paymentFailed"
  | "cashPaymentDue"
  | "bankVerificationPending"
  | "payoutProcessing"
  | "refundProcessed"
  | "businessOrderAlert"
  | "serviceInProgress"
  | "serviceReady"
  | "CANCELLED"
  | OrderTrackingStatus;

export const orderAnimationPaths: Record<OrderAnimationKind, string> = {
  scanPay: "/lottie/order-scan-pay.json?v=scan-qr-payment-20260623",
  paymentDone: "/lottie/order-payment-done.json?v=payment-success-20260623",
  paymentFailed: "/lottie/order-payment-failed.json?v=payment-failed-20260623",
  cashPaymentDue: "/lottie/cash-payment-due.json?v=cash-payment-due-20260623",
  bankVerificationPending: "/lottie/bank-verification-pending.json?v=bank-verification-20260623",
  payoutProcessing: "/lottie/bank-verification-pending.json?v=payout-processing-placeholder-20260629",
  refundProcessed: "/lottie/refund-processed.json?v=refund-processed-20260623",
  businessOrderAlert: "/lottie/business-order-alert-placeholder.json?v=business-alert-20260623",
  serviceInProgress: "/lottie/service-in-progress.json?v=service-progress-20260623",
  serviceReady: "/lottie/service-ready.json?v=service-ready-20260623",
  NEW: "/lottie/order-booking-received.json?v=order-flow-20260623",
  ACCEPTED: "/lottie/order-accepted.json?v=order-flow-20260623",
  PREPARING: "/lottie/order-preparing.json?v=order-flow-20260623",
  READY: "/lottie/order-ready.json?v=order-flow-20260623",
  DELIVERED: "/lottie/order-completed.json?v=order-flow-20260623",
  CANCELLED: "/lottie/order-cancelled.json?v=order-cancelled-20260623"
};

export function getOrderStatusAnimationKind(status: string): OrderAnimationKind | null {
  if (
    status === "NEW" ||
    status === "ACCEPTED" ||
    status === "PREPARING" ||
    status === "READY" ||
    status === "DELIVERED" ||
    status === "CANCELLED"
  ) {
    return status;
  }

  return null;
}

export function usesOrderStatusAnimation(businessType: string, status: string) {
  if (status !== "PREPARING" && status !== "READY") return true;
  return isFoodBusinessType(businessType) || isRetailBusinessType(businessType);
}

export function getBusinessOrderStatusAnimationKind(businessType: string, status: string): OrderAnimationKind | null {
  if (!usesOrderStatusAnimation(businessType, status)) {
    if (status === "PREPARING") return "serviceInProgress";
    if (status === "READY") return "serviceReady";
  }
  return getOrderStatusAnimationKind(status);
}
