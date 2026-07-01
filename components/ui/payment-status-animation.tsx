"use client";

import { ArrowLeftRight, BadgeCheck, Clock3, WalletCards, XCircle } from "lucide-react";
import { orderAnimationPaths } from "@/lib/order-animations";
import { cn } from "@/lib/utils";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";

type PaymentAnimationMode = "auto" | "bankVerification" | "cashDue";

function normalizedProvider(provider?: string | null) {
  return provider?.trim().toLowerCase() ?? "";
}

function paymentAnimationPath(status: string, provider?: string | null, mode: PaymentAnimationMode = "auto") {
  if (status === "COMPLETED") return orderAnimationPaths.paymentDone;
  if (status === "PAID") return orderAnimationPaths.paymentDone;
  if (status === "FAILED") return orderAnimationPaths.paymentFailed;
  if (status === "REFUNDED") return orderAnimationPaths.refundProcessed;
  if (status === "PROCESSING" || status === "PROCESSING_PAYOUT") return orderAnimationPaths.payoutProcessing;
  if (status === "PENDING") {
    const paymentProvider = normalizedProvider(provider);
    if (mode === "bankVerification" || paymentProvider.includes("upi")) return orderAnimationPaths.bankVerificationPending;
    if (mode === "cashDue" || paymentProvider.includes("cash")) return orderAnimationPaths.cashPaymentDue;
    return orderAnimationPaths.scanPay;
  }
  return null;
}

export function PaymentStatusAnimation({
  status,
  provider,
  mode = "auto",
  label,
  className
}: {
  status: string;
  provider?: string | null;
  mode?: PaymentAnimationMode;
  label?: string;
  className?: string;
}) {
  const normalizedLabel = label ?? status.toLowerCase().replaceAll("_", " ");
  const fallback =
    status === "COMPLETED" ? (
      <BadgeCheck className="size-4" />
    ) : status === "FAILED" ? (
      <XCircle className="size-4" />
    ) : status === "PROCESSING" || status === "PROCESSING_PAYOUT" ? (
      <ArrowLeftRight className="size-4" />
    ) : status === "PENDING" ? (
      <Clock3 className="size-4" />
    ) : (
      <WalletCards className="size-4" />
    );

  return (
    <LazyLottieAnimation
      src={paymentAnimationPath(status, provider, mode)}
      label={normalizedLabel}
      loop={status === "PENDING" || status === "PROCESSING" || status === "PROCESSING_PAYOUT"}
      className={cn("payment-status-animation-visual size-8 shrink-0 rounded-lg border border-line bg-white text-ocean", className)}
      animationClassName="payment-status-animation-lottie"
      fallback={fallback}
    />
  );
}
