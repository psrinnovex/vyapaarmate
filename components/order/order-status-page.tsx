"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  CalendarCheck2,
  Check,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  PartyPopper,
  House,
  Phone,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
  ShoppingBag,
  Wallet,
  XCircle
} from "lucide-react";
import type { PublicOrderReceipt } from "@/lib/order-receipt";
import { getOrderTrackingCopy, orderTrackingIndex, type OrderTrackingStatus } from "@/lib/order-tracking";
import { fulfillmentLabelForBusinessType, type ActiveFulfillmentMode } from "@/lib/business-rules";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { cn, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";
import { getBusinessOrderStatusAnimationKind, orderAnimationPaths, usesOrderStatusAnimation, type OrderAnimationKind } from "@/lib/order-animations";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStageVisual(businessType: string, status: OrderTrackingStatus) {
  const icons = getBusinessConsoleIcons(businessType);
  const orderAnimation = usesOrderStatusAnimation(businessType, status);
  const animationKind = getBusinessOrderStatusAnimationKind(businessType, status);

  if (status === "NEW") {
    return { icon: icons.transactionIcon, animationKind: "NEW" as const, spinIcon: false, workingClass: false };
  }
  if (status === "ACCEPTED") {
    return { icon: ClipboardCheck, animationKind: "ACCEPTED" as const, spinIcon: false, workingClass: false };
  }
  if (status === "PREPARING") {
    return {
      icon: orderAnimation ? Loader2 : icons.itemIcon,
      animationKind,
      spinIcon: orderAnimation,
      workingClass: orderAnimation
    };
  }
  if (status === "READY") {
    return {
      icon: orderAnimation ? PackageCheck : icons.fulfillmentIcon,
      animationKind,
      spinIcon: false,
      workingClass: false
    };
  }

  return { icon: PartyPopper, animationKind: "DELIVERED" as const, spinIcon: false, workingClass: false };
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata"
});

const syncTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Kolkata"
});

function dateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function time(value: Date) {
  return syncTimeFormatter.format(value);
}

function OrderStepAnimation({
  kind,
  icon: Icon,
  label,
  className,
  iconClassName,
  lottieClassName,
  loop = true
}: {
  kind?: OrderAnimationKind | null;
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  iconClassName?: string;
  lottieClassName?: string;
  loop?: boolean;
}) {
  const path = kind ? orderAnimationPaths[kind] : null;

  return (
    <LazyLottieAnimation
      src={path}
      label={label}
      loop={loop}
      className={cn("size-14 shrink-0 rounded-2xl", className)}
      animationClassName={lottieClassName}
      fallback={
        <Icon className={cn("size-6", iconClassName)} />
      }
    />
  );
}

function fulfillmentLabel(order: PublicOrderReceipt) {
  if (order.orderType === "DINE_IN" || order.orderType === "PICKUP" || order.orderType === "SERVICE_AT_LOCATION") {
    return fulfillmentLabelForBusinessType(order.business.type, order.orderType as ActiveFulfillmentMode);
  }
  return label(order.orderType);
}

function businessPageHref(order: PublicOrderReceipt) {
  return `/b/${encodeURIComponent(order.business.slug)}`;
}

function FulfillmentIcon({ orderType }: { orderType: string }) {
  if (orderType === "DINE_IN") return <Store className="size-3.5" />;
  if (orderType === "SERVICE_AT_LOCATION") return <House className="size-3.5" />;
  return <ShoppingBag className="size-3.5" />;
}

function PaymentCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="payment-celebration fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/35 px-4 backdrop-blur-sm print:hidden" role="status" aria-live="polite">
      <div className="payment-celebration-card relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/70 bg-white p-7 text-center shadow-[0_32px_100px_rgba(13,19,33,0.32)]">
        <OrderStepAnimation
          kind="paymentDone"
          icon={Check}
          label="Payment done"
          loop={false}
          className="payment-success-icon mx-auto size-28 rounded-full border border-emerald/15 bg-white text-emerald shadow-glow"
          iconClassName="size-12 stroke-[3]"
          lottieClassName="payment-success-lottie scale-[1.08]"
        />
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.22em] text-emerald">Payment verified</p>
        <h2 className="mt-2 text-2xl font-extrabold text-ink">Payment done</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your tracking and paid invoice are ready.</p>
        <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100"><span className="payment-celebration-progress block h-full rounded-full bg-emerald" /></div>
      </div>
      {Array.from({ length: 14 }, (_, index) => <span key={index} className="payment-confetti" aria-hidden="true" />)}
    </div>
  );
}

function PaymentQr({ order, retry }: { order: PublicOrderReceipt; retry: boolean }) {
  if (!order.paymentQrImageUrl) return null;

  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-[260px_1fr] sm:items-center">
      <div className="payment-qr-frame mx-auto w-fit rounded-[1.5rem] border border-line bg-white p-3 shadow-soft">
        <Image src={order.paymentQrImageUrl} alt={`UPI QR for ${order.orderNumber}`} width={240} height={240} unoptimized priority className="size-60 rounded-xl bg-white object-contain" />
        <span className="payment-qr-scanline" aria-hidden="true" />
      </div>
      <div className="text-center sm:text-left">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Amount to pay</p>
        <p className="mt-2 text-4xl font-extrabold tracking-tight text-ink">{formatINR(order.totalAmount)}</p>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-mist p-3 text-left text-sm leading-6 text-slate-600">
          <ScanLine className="mt-0.5 size-5 shrink-0 text-ocean" />
          <span>{retry ? "Scan this QR again to retry in your UPI app." : "Scan this QR using any UPI app and complete the payment there."}</span>
        </div>
        {order.paymentExpiresAt && <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 sm:justify-start"><Clock3 className="size-4" /> Expires {dateTime(order.paymentExpiresAt)}</p>}
      </div>
    </div>
  );
}

function TrackingTimeline({ order }: { order: PublicOrderReceipt }) {
  const tracking = getOrderTrackingCopy(order.business.type, order.orderType);
  const currentIndex = Math.max(0, orderTrackingIndex(order.status));
  const cancelled = order.status === "CANCELLED";
  const visibleStages = tracking.stages.slice(0, currentIndex + 1);
  const nextStage = tracking.stages[currentIndex + 1];

  if (cancelled) {
    return (
      <section id="tracking" className="order-tracker-enter mt-5 overflow-hidden rounded-[1.75rem] border border-red-200 bg-white p-6 shadow-soft print:hidden">
        <div className="flex items-start gap-4 rounded-2xl bg-red-50 p-5 text-red-800">
          <OrderStepAnimation
            kind="CANCELLED"
            icon={XCircle}
            label={tracking.cancelledTitle}
            loop={false}
            className="payment-failure-icon size-14 rounded-2xl bg-red-100 text-red-700"
            iconClassName="size-8"
            lottieClassName="tracking-lottie"
          />
          <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-red-600">Status update</p><h2 className="mt-1 text-xl font-extrabold">{tracking.cancelledTitle}</h2><p className="mt-2 text-sm leading-6 text-red-700">Contact {order.business.name} on {order.business.phone} if you need more information.</p></div>
        </div>
      </section>
    );
  }

  return (
    <section id="tracking" className="order-tracker-enter mt-5 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-soft backdrop-blur-xl print:hidden sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ocean">Progress</p>
          <h2 className="mt-2 text-2xl font-extrabold text-ink">{tracking.progressTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">Only completed admin updates appear here. The next step unlocks when the business updates the status.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald/20 bg-emerald/5 px-3 py-2 text-xs font-bold text-emerald"><span className="payment-pulse-dot size-2.5 rounded-full bg-emerald" /> Tracking</div>
      </div>

      <div className="mt-6 grid gap-3 md:flex md:items-stretch md:overflow-x-auto md:pb-1 lg:overflow-visible">
        {visibleStages.map((stage, index) => {
          const stageVisual = getStageVisual(order.business.type, stage.status);
          const active = index === visibleStages.length - 1;
          const complete = index < visibleStages.length - 1;
          const showCompleteIcon = complete && !active;
          return (
            <div key={stage.status} className="order-progress-card relative md:min-w-[190px] md:flex-1 lg:min-w-0" style={{ animationDelay: `${index * 90}ms` }} aria-current={active ? "step" : undefined}>
              {index > 0 && <span className="absolute -top-3 left-7 h-3 w-0.5 rounded-full bg-emerald/70 md:-left-3 md:top-1/2 md:h-0.5 md:w-3" aria-hidden="true" />}
              <div className={cn("relative z-10 flex items-center gap-4 rounded-2xl border p-4 transition-all duration-500 md:h-full md:flex-col md:items-start", active ? "order-stage-active border-ocean/25 bg-ocean/5 shadow-sm" : "border-emerald/25 bg-emerald/5")}>
                <OrderStepAnimation
                  kind={showCompleteIcon ? null : stageVisual.animationKind}
                  icon={showCompleteIcon ? Check : stageVisual.icon}
                  label={stage.label}
                  className={cn("border bg-white transition-all duration-500", complete ? "border-emerald/25 text-emerald" : "border-ocean/25 text-ocean shadow-[0_10px_30px_rgba(18,70,160,0.16)]")}
                  iconClassName={cn(showCompleteIcon && "stroke-[3]", stageVisual.spinIcon && active && "animate-spin")}
                  lottieClassName="tracking-lottie"
                />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">{complete ? "Completed" : "Current step"}</p>
                  <p className={cn("text-sm font-extrabold", active ? "text-ocean" : complete ? "text-emerald" : "text-slate-500")}>{stage.label}</p>
                  <p className={cn("mt-1 text-sm leading-6", active ? "text-slate-700" : "text-slate-500")}>{stage.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {nextStage && (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-mist/70 p-4 text-sm text-slate-600">
          <span className="font-bold text-ink">Next:</span> {nextStage.label} appears after the business updates this {tracking.transactionLabel}.
        </div>
      )}
    </section>
  );
}

function PaymentStatusPanel({
  order,
  paymentFailed,
  activePaymentQr,
  activeHostedCheckout,
  cashfreeCheckout,
  manualPlatformUpi,
  cancellingPayment,
  paymentError,
  onCancelPayment,
  focused = false
}: {
  order: PublicOrderReceipt;
  paymentFailed: boolean;
  activePaymentQr: boolean;
  activeHostedCheckout: boolean;
  cashfreeCheckout: boolean;
  manualPlatformUpi: boolean;
  cancellingPayment: boolean;
  paymentError: string | null;
  onCancelPayment: () => void;
  focused?: boolean;
}) {
  const pendingPaymentAnimationKind: OrderAnimationKind = manualPlatformUpi ? "bankVerificationPending" : "scanPay";
  const pendingPaymentLabel = manualPlatformUpi ? "Bank verification pending" : "Scan and pay";
  const showPendingPaymentIntro = !cashfreeCheckout;

  return (
    <section id="payment" className={cn("payment-state-enter print:hidden", focused ? "mx-auto mt-6 max-w-[calc(100vw-4.5rem)] sm:max-w-2xl" : "mt-5 rounded-[1.75rem] border border-line bg-white p-5 shadow-sm sm:p-7")}>
      {paymentFailed ? (
        <>
          {activePaymentQr ? (
            <>
              <PaymentQr order={order} retry />
              <div className={cn("mt-5 flex items-center gap-3 rounded-xl border border-ocean/15 bg-ocean/5 p-3 text-sm text-ocean", focused && "justify-center text-center sm:justify-start sm:text-left")}><Loader2 className="size-5 animate-spin" /><span className="font-semibold">Watching for a payment status update</span></div>
            </>
          ) : activeHostedCheckout ? (
            <div className={cn("mt-5 rounded-2xl border border-line bg-mist p-4", focused && "text-center sm:text-left")}>
              <p className={cn("text-sm leading-6 text-slate-600", focused && "mx-auto max-w-[16.5rem] break-words sm:mx-0 sm:max-w-none")}>The Cashfree checkout is still active. Open it to complete the payment, or cancel this booking to stop the appointment.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <ButtonLink href={order.paymentUrl!} variant="emerald" icon={<ExternalLink className="size-4" />}>Pay now</ButtonLink>
                <Button variant="danger" icon={cancellingPayment ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} onClick={onCancelPayment} disabled={cancellingPayment}>
                  {cancellingPayment ? "Cancelling" : "Cancel booking"}
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn("mt-5 rounded-2xl border border-line bg-mist p-4", focused && "text-center sm:text-left")}>
              <p className={cn("text-sm leading-6 text-slate-600", focused && "mx-auto max-w-[16.5rem] break-words sm:mx-0 sm:max-w-none")}>This payment link can no longer be used. Place a fresh booking if you still need the service.</p>
            </div>
          )}
        </>
      ) : (
        <>
          {showPendingPaymentIntro && (
            <div className={cn("flex gap-3", focused ? "flex-col items-center text-center sm:flex-row sm:items-start sm:text-left" : "items-start")}>
              <OrderStepAnimation
                kind={pendingPaymentAnimationKind}
                icon={Wallet}
                label={pendingPaymentLabel}
                className="size-11 rounded-full bg-ocean/10 text-ocean"
                iconClassName="size-5"
                lottieClassName="scan-pay-lottie"
              />
              <div className={cn(focused && "min-w-0 max-w-[16.5rem] sm:max-w-xl")}>
                <h2 className="text-lg font-bold text-ink">Scan and pay</h2>
                <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                  {manualPlatformUpi
                    ? "Scan the UPI QR and complete payment in your UPI app. PSHR admin verifies the bank receipt before your paid invoice and status updates appear."
                    : "Complete the payment in your UPI app. This page detects verification automatically and then shows your paid invoice."}
                </p>
              </div>
            </div>
          )}
          {activePaymentQr ? (
            <>
              <PaymentQr order={order} retry={false} />
              <div className={cn("mt-6 flex items-center gap-3 rounded-xl border border-emerald/20 bg-emerald/5 p-4 text-emerald", focused && "flex-col text-center sm:flex-row sm:text-left")} role="status">
                <span className="payment-pulse-dot size-3 shrink-0 rounded-full bg-emerald" />
                <div>
                  <p className="font-bold">Waiting for payment confirmation</p>
                  <p className="mt-1 text-sm text-slate-600">{manualPlatformUpi ? "Checking for PSHR admin bank verification." : "Checking payment automatically every few seconds."}</p>
                </div>
              </div>
              <Button className="mt-4 w-full" variant="danger" icon={cancellingPayment ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} onClick={onCancelPayment} disabled={cancellingPayment}>
                {cancellingPayment ? "Cancelling booking" : "Cancel booking"}
              </Button>
            </>
          ) : activeHostedCheckout ? (
            <div className={cn("rounded-2xl border border-line bg-mist p-5", showPendingPaymentIntro && "mt-6", focused && "text-center sm:text-left")}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Amount to pay</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-ink">{formatINR(order.totalAmount)}</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <ButtonLink className="w-full" href={order.paymentUrl!} variant="emerald" icon={<ExternalLink className="size-4" />}>Pay now</ButtonLink>
                <Button className="w-full" variant="danger" icon={cancellingPayment ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} onClick={onCancelPayment} disabled={cancellingPayment}>
                  {cancellingPayment ? "Cancelling" : "Cancel booking"}
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn("mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900", focused && "text-center sm:text-left")}>
              <p className="text-sm font-semibold">The payment request is not available. This link cannot be reused for another payment.</p>
            </div>
          )}
        </>
      )}
      {paymentError && <p className={cn("mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700", focused && "text-center sm:text-left")}>{paymentError}</p>}
    </section>
  );
}

function PaymentOnlyPage({
  order,
  shouldPoll,
  lastSyncedAt,
  paymentFailed,
  activePaymentQr,
  activeHostedCheckout,
  cashfreeCheckout,
  manualPlatformUpi,
  cancellingPayment,
  paymentError,
  onCancelPayment
}: {
  order: PublicOrderReceipt;
  shouldPoll: boolean;
  lastSyncedAt: Date;
  paymentFailed: boolean;
  activePaymentQr: boolean;
  activeHostedCheckout: boolean;
  cashfreeCheckout: boolean;
  manualPlatformUpi: boolean;
  cancellingPayment: boolean;
  paymentError: string | null;
  onCancelPayment: () => void;
}) {
  const paymentAnimationKind: OrderAnimationKind = paymentFailed ? "paymentFailed" : manualPlatformUpi ? "bankVerificationPending" : "scanPay";
  const paymentAnimationLabel = paymentFailed ? "Payment retry" : manualPlatformUpi ? "Bank verification pending" : "Scan and pay";
  const businessHref = businessPageHref(order);
  const helpActionLabel = paymentFailed ? "Book again" : "Back to business";

  return (
    <main className="min-h-screen overflow-x-hidden bg-mesh-light px-4 py-6 print:bg-white print:p-0 sm:py-9">
      <div className="mx-auto max-w-[calc(100vw-2rem)] sm:max-w-3xl">
        <section className="payment-state-enter overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-soft backdrop-blur-xl sm:p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">{order.business.type}</p>
              <h1 className="mt-1 break-words text-xl font-extrabold text-ink">{order.business.name}</h1>
            </div>
            <div className={cn("flex max-w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-bold", paymentFailed ? "border-red-200 bg-red-50 text-red-700" : "border-emerald/20 bg-emerald/5 text-emerald")}>
              <span className={cn("size-2 rounded-full", shouldPoll && !paymentFailed ? "payment-pulse-dot" : "", paymentFailed ? "bg-red-500" : "bg-emerald")} />
              {shouldPoll ? `Checking · ${time(lastSyncedAt)}` : `Updated ${dateTime(order.updatedAt)}`}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 justify-items-center gap-5 text-center sm:grid-cols-[168px_1fr] sm:items-center sm:justify-items-start sm:text-left">
            <OrderStepAnimation
              kind={paymentAnimationKind}
              icon={paymentFailed ? XCircle : ScanLine}
              label={paymentAnimationLabel}
              className={cn("size-36 rounded-[1.75rem] border", paymentFailed ? "border-red-200 bg-red-50 text-red-700" : "border-ocean/15 bg-white text-ocean shadow-sm")}
              iconClassName="size-12"
              lottieClassName={paymentFailed ? "payment-failure-lottie" : "scan-pay-lottie"}
            />
            <div className="min-w-0 max-w-[calc(100vw-4.5rem)] sm:max-w-xl">
              <Badge variant={paymentFailed ? "red" : "blue"}>{paymentFailed ? "Payment failed" : "Step 1"}</Badge>
              <h2 className="mx-auto mt-3 max-w-[17rem] text-3xl font-extrabold text-ink sm:mx-0 sm:max-w-none">{paymentFailed ? "Payment needs attention" : cashfreeCheckout ? "Complete payment" : "Scan and pay"}</h2>
              <p className="mx-auto mt-3 max-w-[16.5rem] break-words text-sm leading-6 text-slate-600 sm:mx-0 sm:max-w-xl">
                {paymentFailed
                  ? "This request failed, expired, or was cancelled. This payment link cannot be reused."
                  : "Only the payment step is shown now. Once payment is verified, your paid invoice downloads and progress will appear here."}
              </p>
              {paymentFailed && (order.paymentFailureReason || order.paymentFailedAt) && (
                <div className="mx-auto mt-3 max-w-[16.5rem] space-y-1 break-words text-sm leading-6 sm:mx-0 sm:max-w-xl">
                  {order.paymentFailureReason && <p className="font-semibold text-red-700">{order.paymentFailureReason}</p>}
                  {order.paymentFailedAt && <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-500">Updated {dateTime(order.paymentFailedAt)}</p>}
                </div>
              )}
            </div>
          </div>

          <PaymentStatusPanel
            order={order}
            paymentFailed={paymentFailed}
            activePaymentQr={activePaymentQr}
            activeHostedCheckout={activeHostedCheckout}
            cashfreeCheckout={cashfreeCheckout}
            manualPlatformUpi={manualPlatformUpi}
            cancellingPayment={cancellingPayment}
            paymentError={paymentError}
            onCancelPayment={onCancelPayment}
            focused
          />
        </section>

        <div className="mt-5 rounded-[1.5rem] border border-line bg-white p-5 text-center shadow-sm sm:text-left">
          <h2 className="font-extrabold text-ink">Need help?</h2>
          <p className="mx-auto mt-2 max-w-[18rem] break-words text-sm leading-6 text-slate-600 sm:mx-0 sm:max-w-none">Contact {order.business.name} if the payment is not updating.</p>
          <div className="mx-auto mt-4 grid w-full max-w-[17rem] gap-2 sm:mx-0 sm:max-w-none sm:grid-cols-2">
            <a href={`tel:${order.business.phone}`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-bold text-white transition hover:bg-black/90"><Phone className="size-4" /> Call {order.business.phone}</a>
            <ButtonLink href={businessHref} variant="secondary" icon={<CalendarCheck2 className="size-4" />} className="w-full">
              {helpActionLabel}
            </ButtonLink>
          </div>
        </div>
      </div>
    </main>
  );
}

export function OrderStatusPage({ publicToken, initialOrder }: { publicToken: string; initialOrder: PublicOrderReceipt }) {
  const [order, setOrder] = useState(initialOrder);
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date(initialOrder.updatedAt));
  const [showCelebration, setShowCelebration] = useState(false);
  const refreshInFlight = useRef(false);
  const previousPaymentStatus = useRef(initialOrder.paymentStatus);
  const previousPaymentFailed = useRef(initialOrder.paymentStatus === "FAILED" || initialOrder.paymentExpired);
  const dismissCelebration = useCallback(() => setShowCelebration(false), []);

  const refresh = useCallback(async (options: { checkoutReturned?: boolean } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const query = options.checkoutReturned ? "?checkout=return" : "";
      const response = await fetch(`/api/orders/${encodeURIComponent(publicToken)}${query}`, { cache: "no-store" });
      if (response.ok) {
        setOrder((await response.json()) as PublicOrderReceipt);
        setLastSyncedAt(new Date());
      }
    } finally {
      refreshInFlight.current = false;
    }
  }, [publicToken]);

  const paid = order.paymentStatus === "COMPLETED";
  const paymentFailed =
    order.paymentMethod === "UPI" &&
    !paid &&
    (order.paymentStatus === "FAILED" || order.paymentStatus === "REFUNDED" || order.paymentExpired);
  const cashfreeCheckout = order.paymentProvider === "CASHFREE";
  const platformVerifiesPayment = order.paymentProvider === "UPI";
  const manualPlatformUpi = platformVerifiesPayment && !paid;
  const activePaymentQr = Boolean(order.paymentUrl && order.paymentQrImageUrl && !order.paymentExpired);
  const activeHostedCheckout = Boolean(order.paymentUrl && cashfreeCheckout && !order.paymentExpired);
  const orderTerminal = order.status === "DELIVERED" || order.status === "CANCELLED";
  const waitingForPayment = order.paymentMethod === "UPI" && !paid && !paymentFailed;
  const shouldPoll = !orderTerminal || waitingForPayment;
  const tracking = getOrderTrackingCopy(order.business.type, order.orderType);
  const currentStageIndex = Math.max(0, orderTrackingIndex(order.status));
  const currentStage = tracking.stages[currentStageIndex] ?? tracking.stages[0];
  const currentStageVisual = getStageVisual(order.business.type, currentStage.status);
  const CurrentStageIcon = order.status === "CANCELLED" ? XCircle : currentStageVisual.icon;

  useEffect(() => {
    const events = new EventSource(`/api/orders/${encodeURIComponent(publicToken)}?stream=1&skipInitial=1`);
    const handleOrder = (event: Event) => {
      const message = event as MessageEvent<string>;
      try {
        setOrder(JSON.parse(message.data) as PublicOrderReceipt);
        setLastSyncedAt(new Date());
      } catch {
        void refresh();
      }
    };

    events.addEventListener("order", handleOrder);
    events.addEventListener("sync-error", () => void refresh());
    return () => {
      events.removeEventListener("order", handleOrder);
      events.close();
    };
  }, [publicToken, refresh]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, shouldPoll]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "return") void refresh({ checkoutReturned: true });
    if ((params.get("payment") === "success" || (params.get("checkout") === "return" && paid)) && paid) {
      window.requestAnimationFrame(() => {
        setShowCelebration(true);
        document.getElementById("tracking")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else if (params.get("payment") === "failed") {
      window.requestAnimationFrame(() => document.getElementById("payment")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }, [paid, refresh]);

  useEffect(() => {
    const wasPaid = previousPaymentStatus.current === "COMPLETED";
    const wasFailed = previousPaymentFailed.current;
    previousPaymentStatus.current = order.paymentStatus;
    previousPaymentFailed.current = paymentFailed;

    if (!wasPaid && paid) {
      window.location.replace(`/order/${encodeURIComponent(publicToken)}?payment=success#tracking`);
      return;
    }
    if (!wasFailed && paymentFailed) {
      window.location.replace(`/order/${encodeURIComponent(publicToken)}?payment=failed#payment`);
    }
  }, [order.paymentStatus, paid, paymentFailed, publicToken]);

  async function cancelPayment() {
    const confirmed = window.confirm("Cancel this booking and stop the online payment? You will need to book again if you still want the appointment.");
    if (!confirmed) return;

    setCancellingPayment(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(publicToken)}/payment`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
      if (!response.ok) {
        setPaymentError(typeof payload.error === "string" ? payload.error : "Could not cancel this booking.");
        return;
      }
      await refresh();
    } catch {
      setPaymentError("Could not reach the booking server. Try again.");
    } finally {
      setCancellingPayment(false);
    }
  }

  const paymentMethodLabel = order.paymentMethod === "CASH" ? "Cash" : cashfreeCheckout ? (paid ? "Online payment" : "Cashfree checkout") : "PSHR Innovex UPI";
  const transactionTitle = label(tracking.transactionLabel);
  const heroCancelled = order.status === "CANCELLED";
  const heroCompleted = order.status === "DELIVERED";
  const showPaymentOnly = order.paymentMethod === "UPI" && !paid && order.status !== "CANCELLED";
  const invoiceDownloadUrl = `/api/orders/${encodeURIComponent(publicToken)}/invoice`;
  const fulfillmentModeLabel = fulfillmentLabel(order).toLowerCase();
  const businessHref = businessPageHref(order);
  const customerReturnLabel = heroCancelled || heroCompleted ? "Book again" : "Back to business";
  const customerAddressLabel =
    order.orderType === "SERVICE_AT_LOCATION"
      ? fulfillmentModeLabel.includes("delivery")
        ? "Delivery address"
        : fulfillmentModeLabel.includes("home")
          ? "Home address"
          : "Service address"
      : "Customer address";

  if (showPaymentOnly) {
    return (
      <PaymentOnlyPage
        order={order}
        shouldPoll={shouldPoll}
        lastSyncedAt={lastSyncedAt}
        paymentFailed={paymentFailed}
        activePaymentQr={activePaymentQr}
        activeHostedCheckout={activeHostedCheckout}
        cashfreeCheckout={cashfreeCheckout}
        manualPlatformUpi={manualPlatformUpi}
        cancellingPayment={cancellingPayment}
        paymentError={paymentError}
        onCancelPayment={cancelPayment}
      />
    );
  }

  return (
    <main className="min-h-screen bg-mesh-light px-4 py-6 print:bg-white print:p-0 sm:py-9">
      {showCelebration && <PaymentCelebration onDone={dismissCelebration} />}
      <div className="mx-auto max-w-5xl">
        <section className={cn("order-hero-enter relative overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_28px_90px_rgba(13,19,33,0.28)] print:hidden sm:p-8", heroCancelled ? "bg-gradient-to-br from-red-800 via-red-700 to-rose-900" : heroCompleted ? "bg-gradient-to-br from-emerald via-teal-700 to-ink" : "bg-gradient-to-br from-ink via-slate-900 to-ocean")}>
          <div className="order-hero-orb order-hero-orb-one" aria-hidden="true" /><div className="order-hero-orb order-hero-orb-two" aria-hidden="true" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-white/10 backdrop-blur-md"><Sparkles className="size-5 text-emerald-200" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">{order.business.type}</p><p className="font-bold">{order.business.name}</p></div></div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur-md"><span className={cn("size-2 rounded-full", shouldPoll ? "payment-pulse-dot bg-emerald-300" : "bg-white/55")} />{shouldPoll ? `Updated ${time(lastSyncedAt)}` : `Updated ${dateTime(order.updatedAt)}`}</div>
          </div>

          <div key={order.status} className="relative z-10 mt-9">
            <div>
              <div className="flex items-start gap-4">
                <OrderStepAnimation
                  kind={order.status === "CANCELLED" ? "CANCELLED" : currentStageVisual.animationKind}
                  icon={CurrentStageIcon}
                  label={heroCancelled ? tracking.cancelledTitle : currentStage.label}
                  className={cn("order-current-icon size-16 border border-white/15 bg-white/10 text-white backdrop-blur-md", currentStageVisual.workingClass && order.status === "PREPARING" && "order-current-icon-working")}
                  iconClassName={cn("size-8", currentStageVisual.spinIcon && order.status === "PREPARING" && "animate-spin")}
                  lottieClassName="tracking-lottie"
                />
                <div>
                  <p className="text-sm font-semibold text-white/60">{label(tracking.transactionLabel)} {order.orderNumber}</p>
                  <h1 className={cn("mt-1", heroCompleted ? "text-xl font-extrabold leading-7 sm:text-2xl" : "text-3xl font-extrabold sm:text-4xl")}>{heroCancelled ? tracking.cancelledTitle : heroCompleted ? tracking.completedTitle : currentStage.label}</h1>
                  <p className={cn("mt-3 max-w-2xl leading-6 text-white/70", heroCompleted ? "text-xs sm:text-sm" : "text-sm sm:text-base")}>{heroCancelled ? `This ${tracking.transactionLabel} was cancelled. Contact the business for help.` : currentStage.description}</p>
                  {heroCompleted && (
                    <div className="mt-5">
                      <ButtonLink href={businessHref} variant="secondary" icon={<CalendarCheck2 className="size-4" />} className="bg-white text-ink hover:bg-white/90">
                        Book again
                      </ButtonLink>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {order.customer.whatsappUpdates && <p className="relative z-10 mt-6 flex items-center gap-2 rounded-xl bg-white/10 p-3 text-sm text-white/75 backdrop-blur-sm"><MessageCircle className="size-4 text-emerald-200" /> Status updates are also sent to your WhatsApp.</p>}
        </section>

        {paid && (
          <section id="invoice" className="payment-state-enter mt-5 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-emerald/25 bg-emerald/5 p-5 print:hidden sm:flex-row sm:items-center">
            <div className="flex items-center gap-4"><OrderStepAnimation kind="paymentDone" icon={BadgeCheck} label="Payment successful and verified" loop={false} className="payment-success-icon size-16 rounded-2xl border border-emerald/20 bg-white text-emerald shadow-sm" iconClassName="size-7" lottieClassName="payment-success-lottie scale-[1.1]" /><div><h2 className="font-extrabold text-ink">Payment successful and verified</h2><p className="mt-1 text-sm text-slate-600">{paymentMethodLabel}{order.paidAt ? ` · ${dateTime(order.paidAt)}` : ""}</p></div></div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <a href={invoiceDownloadUrl} download className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald/90 sm:w-auto"><Download className="size-4" /> Download invoice</a>
              <div className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-emerald shadow-sm sm:w-auto"><ShieldCheck className="size-4" /> Secure payment</div>
            </div>
          </section>
        )}

        <TrackingTimeline order={order} />

        <section className="mt-5 grid gap-5 print:hidden lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[1.75rem] border border-line bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-extrabold text-ink">{transactionTitle} details</h2>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl bg-mist/70 p-4">
                <Wallet className="mt-0.5 size-5 shrink-0 text-emerald" />
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-ink">{formatINR(order.totalAmount)}</p>
                  <p className="mt-1 text-slate-500">Total</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-mist/70 p-4">
                <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-ocean" />
                <div className="min-w-0">
                  <p className="font-bold leading-6 text-ink">{dateTime(order.createdAt)}</p>
                  <p className="mt-1 text-slate-500">Placed</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-mist/70 p-4">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-ocean"><FulfillmentIcon orderType={order.orderType} /></span>
                <div className="min-w-0">
                  <p className="font-bold text-ink">{fulfillmentLabel(order)}</p>
                  <p className="mt-1 text-slate-500">Fulfillment method</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-mist/70 p-4">
                <CircleDot className="mt-0.5 size-5 shrink-0 text-emerald" />
                <div className="min-w-0">
                  <p className="font-bold leading-6 text-ink">{dateTime(order.updatedAt)}</p>
                  <p className="mt-1 text-slate-500">Last status update</p>
                </div>
              </div>
              {order.customer.address && (
                <div className="flex items-start gap-3 rounded-2xl bg-mist/70 p-4 sm:col-span-2">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-ocean" />
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{customerAddressLabel}</p>
                    <p className="mt-1 break-words leading-6 text-slate-500">{order.customer.address}</p>
                  </div>
                </div>
              )}
              {order.notes && (
                <div className="rounded-2xl bg-mist/70 p-4 sm:col-span-2">
                  <p className="font-bold text-ink">Notes</p>
                  <p className="mt-1 break-words leading-6 text-slate-500">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-[1.5rem] border border-line bg-white p-5 shadow-sm">
              <h2 className="font-extrabold text-ink">Need help?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Contact {order.business.name} about this {tracking.transactionLabel}.</p>
              <div className="mt-4 grid gap-2">
                <a href={`tel:${order.business.phone}`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-bold text-white transition hover:bg-black/90"><Phone className="size-4" /> Call {order.business.phone}</a>
                <ButtonLink href={businessHref} variant="secondary" icon={<CalendarCheck2 className="size-4" />} className="w-full">
                  {customerReturnLabel}
                </ButtonLink>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
