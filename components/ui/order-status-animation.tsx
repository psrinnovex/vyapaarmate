"use client";

import { BellRing, CheckCircle2, FileCheck2, LoaderCircle, XCircle } from "lucide-react";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { getOrderTrackingStatusLabel } from "@/lib/order-tracking";
import { getBusinessOrderStatusAnimationKind, orderAnimationPaths, usesOrderStatusAnimation } from "@/lib/order-animations";
import { cn } from "@/lib/utils";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";

export function OrderStatusAnimation({
  status,
  businessType,
  orderType,
  label,
  className
}: {
  status: string;
  businessType: string;
  orderType: string;
  label?: string;
  className?: string;
}) {
  const icons = getBusinessConsoleIcons(businessType);
  const TransactionFallbackIcon = icons.transactionIcon;
  const useOrderAnimation = usesOrderStatusAnimation(businessType, status);
  const animationKind = getBusinessOrderStatusAnimationKind(businessType, status);
  const animationPath = animationKind ? orderAnimationPaths[animationKind] : null;
  const statusLabel = label ?? getOrderTrackingStatusLabel(businessType, orderType, status);
  const iconClassName = cn("size-4", status === "PREPARING" && useOrderAnimation && "animate-spin");
  const PreparingFallbackIcon = useOrderAnimation ? LoaderCircle : icons.itemIcon;
  const ReadyFallbackIcon = useOrderAnimation ? BellRing : icons.fulfillmentIcon;
  const fallback =
    status === "NEW" ? (
      <TransactionFallbackIcon className={iconClassName} />
    ) : status === "ACCEPTED" ? (
      <CheckCircle2 className={iconClassName} />
    ) : status === "PREPARING" ? (
      <PreparingFallbackIcon className={iconClassName} />
    ) : status === "READY" ? (
      <ReadyFallbackIcon className={iconClassName} />
    ) : status === "DELIVERED" ? (
      <FileCheck2 className={iconClassName} />
    ) : (
      <XCircle className={iconClassName} />
    );

  return (
    <LazyLottieAnimation
      src={animationPath}
      label={statusLabel}
      className={cn("order-status-animation-visual size-9 shrink-0 rounded-lg border border-line bg-white text-ocean", className)}
      animationClassName="order-status-animation-lottie"
      fallback={fallback}
    />
  );
}
