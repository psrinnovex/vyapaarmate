"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ReceiptText,
  Volume2,
  VolumeX,
  XCircle
} from "lucide-react";
import { useDashboardLive, useDashboardOrderAlertLive } from "@/hooks/use-live-sync";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { getOrderTrackingStatusLabel } from "@/lib/order-tracking";
import { orderAnimationPaths } from "@/lib/order-animations";
import type { LiveDashboardPayload, LiveOrder, LiveOrderStatus } from "@/lib/live-types";
import { formatINR } from "@/lib/utils";
import { ActionNotice, type ActionNoticeState } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";

const businessOrderAlertSoundPath = "/audio/order-alert.mp3";
const businessOrderAlertSoundGain = 2;

function orderDecisionText(status: LiveOrderStatus, businessType: string, orderType: string) {
  if (status === "CANCELLED") return "declined";
  return getOrderTrackingStatusLabel(businessType, orderType, status).toLowerCase();
}

function replaceOrder(payload: LiveDashboardPayload, updatedOrder: LiveOrder): LiveDashboardPayload {
  const orders = payload.orders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
  const recentOrders = payload.recentOrders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));

  return { ...payload, orders, recentOrders, syncedAt: new Date().toISOString() };
}

async function readActionError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string") return payload.error;

    if (payload.error && typeof payload.error === "object") {
      const flattened = payload.error as {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
      const errors = [
        ...(flattened.formErrors ?? []),
        ...Object.entries(flattened.fieldErrors ?? {}).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => `${field}: ${message}`)
        )
      ];
      if (errors.length > 0) return errors.join(" ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function useOrderAlertSound(active: boolean) {
  const [soundEnabled, setSoundEnabled] = useState(() =>
    typeof window === "undefined" ? false : window.localStorage.getItem("businessOrderAlertSound") === "enabled"
  );
  const [soundBlocked, setSoundBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);

  const getAlertAudio = useCallback(() => {
    if (typeof window === "undefined") return null;

    const audio = audioRef.current ?? new Audio(businessOrderAlertSoundPath);
    audioRef.current = audio;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 1;

    if (!audioGainRef.current && window.AudioContext) {
      try {
        const audioContext = audioContextRef.current ?? new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        const gain = audioContext.createGain();

        gain.gain.value = businessOrderAlertSoundGain;
        source.connect(gain).connect(audioContext.destination);

        audioContextRef.current = audioContext;
        audioGainRef.current = gain;
      } catch {
        audio.volume = 1;
      }
    } else if (audioGainRef.current) {
      audioGainRef.current.gain.value = businessOrderAlertSoundGain;
    }

    return audio;
  }, []);

  const stopAlertSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers reject seeking before metadata is ready.
    }
  }, []);

  const startAlertSound = useCallback(async () => {
    const audio = getAlertAudio();
    if (!audio) return false;

    try {
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }
      audio.currentTime = 0;
      await audio.play();
      setSoundBlocked(false);
      return true;
    } catch {
      setSoundBlocked(true);
      return false;
    }
  }, [getAlertAudio]);

  const enableSound = useCallback(async () => {
    setSoundEnabled(true);
    window.localStorage.setItem("businessOrderAlertSound", "enabled");
    const played = active ? await startAlertSound() : true;
    if (!played) {
      setSoundEnabled(false);
      window.localStorage.setItem("businessOrderAlertSound", "disabled");
    }
  }, [active, startAlertSound]);

  const disableSound = useCallback(() => {
    setSoundEnabled(false);
    setSoundBlocked(false);
    stopAlertSound();
    window.localStorage.setItem("businessOrderAlertSound", "disabled");
  }, [stopAlertSound]);

  useEffect(() => {
    if (!active || !soundEnabled) {
      stopAlertSound();
      return;
    }

    const startTimer = window.setTimeout(() => {
      void startAlertSound().then((played) => {
        if (!played) {
          setSoundEnabled(false);
          window.localStorage.setItem("businessOrderAlertSound", "disabled");
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      stopAlertSound();
    };
  }, [active, soundEnabled, startAlertSound, stopAlertSound]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      void audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (active || !soundBlocked) return;

    const reset = window.setTimeout(() => {
      setSoundBlocked(false);
    }, 0);

    return () => window.clearTimeout(reset);
  }, [active, soundBlocked]);

  return { soundEnabled, soundBlocked, enableSound, disableSound };
}

function usePendingOrderDocumentTitle(count: number, transactionPlural: string) {
  useEffect(() => {
    if (count === 0) return;

    const originalTitle = document.title;
    let urgent = true;
    const timer = window.setInterval(() => {
      document.title = urgent ? `(${count}) New ${transactionPlural.toLowerCase()}` : originalTitle;
      urgent = !urgent;
    }, 1600);

    document.title = `(${count}) New ${transactionPlural.toLowerCase()}`;

    return () => {
      window.clearInterval(timer);
      document.title = originalTitle;
    };
  }, [count, transactionPlural]);
}

export function DashboardBookingAlert({
  canReviewOrders,
  canUpdateOrders
}: {
  canReviewOrders: boolean;
  canUpdateOrders: boolean;
}) {
  const router = useRouter();
  const dashboardLive = useDashboardLive();
  const alertLive = useDashboardOrderAlertLive();
  const data = alertLive.data;
  const copy = getBusinessConsoleCopy(data.business.businessType);
  const [updatingOrder, setUpdatingOrder] = useState<{ id: string; status: LiveOrderStatus } | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const pendingOrders = useMemo(
    () =>
      data.orders
        .filter((order) => order.status === "NEW")
        .slice()
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    [data.orders]
  );
  const alertSound = useOrderAlertSound(pendingOrders.length > 0);
  const primaryOrder = pendingOrders[0];
  const accepting = Boolean(primaryOrder && updatingOrder?.id === primaryOrder.id && updatingOrder.status === "ACCEPTED");
  const declining = Boolean(primaryOrder && updatingOrder?.id === primaryOrder.id && updatingOrder.status === "CANCELLED");
  const locked = Boolean(primaryOrder && updatingOrder?.id === primaryOrder.id);
  const extraOrders = pendingOrders.slice(1, 4);

  usePendingOrderDocumentTitle(pendingOrders.length, copy.transactionPlural);

  const updateVisibleDashboardOrder = useCallback(
    (updatedOrder: LiveOrder) => {
      dashboardLive.setData((current) => {
        const hasOrder = current.orders.some((order) => order.id === updatedOrder.id) || current.recentOrders.some((order) => order.id === updatedOrder.id);
        return hasOrder ? replaceOrder(current, updatedOrder) : current;
      });
    },
    [dashboardLive]
  );

  const updateOrderStatus = useCallback(
    async (order: LiveOrder, status: LiveOrderStatus) => {
      if (!canUpdateOrders) {
        setNotice({ tone: "error", message: `You do not have permission to update ${copy.transactionPlural.toLowerCase()}.` });
        return;
      }

      const updatedOrder = { ...order, status };
      const decisionText = orderDecisionText(status, data.business.businessType, order.orderType);

      if (data.source !== "database") {
        alertLive.setData((current) => replaceOrder(current, updatedOrder));
        updateVisibleDashboardOrder(updatedOrder);
        setNotice({ tone: "success", message: `${copy.transactionSingular} ${order.orderNumber} marked ${decisionText}.` });
        return;
      }

      setUpdatingOrder({ id: order.id, status });
      setNotice(null);

      try {
        const response = await fetch(`/api/dashboard/orders/${encodeURIComponent(order.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        });

        if (!response.ok) {
          await Promise.all([alertLive.refresh(), dashboardLive.refresh()]);
          setNotice({
            tone: "error",
            message: await readActionError(response, `Could not update ${copy.transactionSingular.toLowerCase()} ${order.orderNumber}. Data was refreshed.`)
          });
          return;
        }

        const payload = (await response.json().catch(() => null)) as { order?: Pick<LiveOrder, "status" | "paymentStatus"> } | null;
        const persistedOrder = {
          ...updatedOrder,
          status: payload?.order?.status ?? status,
          paymentStatus: payload?.order?.paymentStatus ?? order.paymentStatus
        };
        alertLive.setData((current) => replaceOrder(current, persistedOrder));
        updateVisibleDashboardOrder(persistedOrder);
        await Promise.all([alertLive.refresh(), dashboardLive.refresh()]);
        setNotice({ tone: "success", message: `${copy.transactionSingular} ${order.orderNumber} saved as ${orderDecisionText(persistedOrder.status, data.business.businessType, order.orderType)}.` });
      } catch {
        await Promise.all([alertLive.refresh(), dashboardLive.refresh()]);
        setNotice({ tone: "error", message: `Could not reach the server. ${copy.transactionSingular} ${order.orderNumber} was refreshed from saved data.` });
      } finally {
        setUpdatingOrder((current) => (current?.id === order.id ? null : current));
      }
    },
    [alertLive, canUpdateOrders, copy.transactionPlural, copy.transactionSingular, dashboardLive, data.business.businessType, data.source, updateVisibleDashboardOrder]
  );

  if (!primaryOrder || !canReviewOrders) {
    return <ActionNotice notice={notice} onClose={() => setNotice(null)} />;
  }

  return (
    <>
      <section className="business-order-alert relative mb-5 overflow-hidden rounded-lg border border-amber-200 bg-white p-4 shadow-soft" role="alert" aria-live="assertive">
        <span className="business-order-alert-sweep" aria-hidden="true" />
        <div className="relative grid gap-4 lg:grid-cols-[116px_minmax(0,1fr)_minmax(220px,256px)] lg:items-center">
          <div className="business-order-alert-visual relative mx-auto grid size-28 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 lg:mx-0">
            <LazyLottieAnimation
              src={orderAnimationPaths.businessOrderAlert}
              label={`New ${copy.transactionSingular.toLowerCase()} alert`}
              className="business-order-alert-lottie size-full"
              animationClassName="business-order-alert-lottie"
              fallback={<BellRing className="business-order-alert-fallback size-12" />}
            />
            <span className="business-order-alert-ping" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="amber" className="whitespace-normal">
                {pendingOrders.length} new {pendingOrders.length === 1 ? copy.transactionSingular.toLowerCase() : copy.transactionPlural.toLowerCase()}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                <Clock3 className="size-3.5 shrink-0" />
                {primaryOrder.time}
              </span>
            </div>
            <h2 className="mt-2 break-words text-xl font-extrabold text-ink">New {copy.transactionSingular.toLowerCase()} needs a decision</h2>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">
              <span className="font-bold text-ink">{primaryOrder.orderNumber}</span> from {primaryOrder.customer} for {formatINR(primaryOrder.amount)}
            </p>
            <p className="mt-1 break-words text-sm text-slate-500">{primaryOrder.items}</p>
            {alertSound.soundBlocked && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                Click Enable sound to start the alert chime in this browser.
              </p>
            )}
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              variant="emerald"
              icon={accepting ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              disabled={locked || !canUpdateOrders}
              onClick={() => void updateOrderStatus(primaryOrder, "ACCEPTED")}
            >
              {accepting ? "Accepting" : "Accept"}
            </Button>
            <Button
              variant="danger"
              icon={declining ? <LoaderCircle className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              disabled={locked || !canUpdateOrders}
              onClick={() => void updateOrderStatus(primaryOrder, "CANCELLED")}
            >
              {declining ? "Declining" : "Decline"}
            </Button>
            <Button
              variant="secondary"
              icon={<ReceiptText className="size-4" />}
              onClick={() => router.push(`/dashboard/orders?booking=${encodeURIComponent(primaryOrder.id)}`)}
            >
              Review
            </Button>
            <Button
              variant={alertSound.soundEnabled ? "secondary" : "primary"}
              icon={alertSound.soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              onClick={alertSound.soundEnabled ? alertSound.disableSound : () => void alertSound.enableSound()}
            >
              {alertSound.soundEnabled ? "Sound on" : "Enable sound"}
            </Button>
          </div>
        </div>

        {extraOrders.length > 0 && (
          <div className="relative mt-4 grid gap-2 border-t border-amber-100 pt-4 sm:grid-cols-3">
            {extraOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                className="min-w-0 rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                onClick={() => router.push(`/dashboard/orders?booking=${encodeURIComponent(order.id)}`)}
              >
                <p className="break-words text-sm font-bold text-ink [overflow-wrap:anywhere]" title={order.orderNumber}>{order.orderNumber}</p>
                <p className="mt-1 break-words text-xs text-slate-600">{order.customer} - {formatINR(order.amount)}</p>
              </button>
            ))}
          </div>
        )}
      </section>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}
