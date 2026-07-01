"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

type SupportAssignmentAlertTicket = {
  id: string;
  assignedToUserId: string | null;
  status: string;
  code?: string | null;
  subject?: string | null;
  businessName?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  messages?: SupportAssignmentAlertMessage[];
};

type SupportAssignmentAlertMessage = {
  id: string;
  sender: string;
  body: string;
  createdAt: string;
};

type SupportAssignmentAlertKind = "assignment" | "customer-message";

type SupportAssignmentAlertEvent = {
  key: string;
  kind: SupportAssignmentAlertKind;
  ticket: SupportAssignmentAlertTicket;
  message?: SupportAssignmentAlertMessage | null;
  receivedAt: number;
};

type SupportAssignmentAlertPayload = {
  tickets?: SupportAssignmentAlertTicket[];
};

type BrowserNotificationOptions = {
  enabled: boolean;
  href?: string;
};

type AudioContextConstructor = typeof AudioContext;
type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: AudioContextConstructor;
};

const supportAssignmentAlertPath = "/audio/support-agent-alert.mp3";
const supportAssignmentAlertGain = 2;
const supportAlertAckStorageKey = "vyapaarmate_support_agent_alert_ack";
const activeSupportChatStatuses = new Set(["IN_REVIEW", "WAITING_ON_CUSTOMER"]);
const supportAlertRefreshMs = 60000;
const supportAlertRepeatMs = 3200;
const maxPendingAlerts = 5;

export function useSupportAssignmentAlertFeed({
  currentUserId,
  enabled = true,
  href = "/support"
}: {
  currentUserId?: string | null;
  enabled?: boolean;
  href?: string;
}) {
  const [tickets, setTickets] = useState<SupportAssignmentAlertTicket[]>([]);

  const loadTickets = useCallback(async () => {
    if (!enabled || !currentUserId) {
      setTickets([]);
      return;
    }

    const response = await fetch("/api/admin/support", {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (response.status === 401 || response.status === 403) {
      setTickets([]);
      return;
    }
    if (!response.ok) throw new Error(`Support alert feed failed with ${response.status}`);

    const payload = (await response.json()) as SupportAssignmentAlertPayload;
    setTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
  }, [currentUserId, enabled]);

  useEffect(() => {
    if (!enabled || !currentUserId) {
      return;
    }

    let cancelled = false;
    const refresh = () => {
      void loadTickets().catch(() => {
        if (!cancelled) setTickets((current) => current);
      });
    };

    refresh();

    const events = new EventSource("/api/admin/support?stream=1&skipInitial=1");
    events.addEventListener("support", refresh);
    events.addEventListener("sync-error", refresh);
    events.onerror = () => undefined;

    const fallback = window.setInterval(refresh, supportAlertRefreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(fallback);
      events.removeEventListener("support", refresh);
      events.removeEventListener("sync-error", refresh);
      events.close();
    };
  }, [currentUserId, enabled, loadTickets]);

  return useSupportAssignmentAlert({
    tickets,
    currentUserId,
    enabled,
    browserNotification: {
      enabled: true,
      href
    },
    onRefresh: loadTickets
  });
}

export function useSupportAssignmentAlert({
  tickets,
  currentUserId,
  enabled = true,
  browserNotification = { enabled: false },
  onRefresh
}: {
  tickets: SupportAssignmentAlertTicket[];
  currentUserId?: string | null;
  enabled?: boolean;
  browserNotification?: BrowserNotificationOptions;
  onRefresh?: () => Promise<void>;
}) {
  const [pendingAlerts, setPendingAlerts] = useState<SupportAssignmentAlertEvent[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const audioPlayingRef = useRef(false);
  const previousTicketsRef = useRef<Map<string, SupportAssignmentAlertTicket>>(new Map());
  const pendingAlertsRef = useRef<SupportAssignmentAlertEvent[]>([]);
  const primedRef = useRef(false);
  const currentUserRef = useRef<string | null | undefined>(currentUserId);
  const originalTitleRef = useRef<string | null>(null);
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pendingAlertsRef.current = pendingAlerts;
  }, [pendingAlerts]);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    const audio = new Audio(supportAssignmentAlertPath);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;
    let unlockAttempted = false;

    const unlockAudio = () => {
      if (unlockAttempted) return;
      unlockAttempted = true;

      audio.muted = true;
      void audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => undefined)
        .finally(() => {
          audio.muted = false;
        });

      void connectAmplifiedAudio(audio, audioContextRef, audioSourceRef, audioGainRef)
        ?.resume()
        .catch(() => undefined);

      if (browserNotification.enabled) {
        void requestBrowserNotificationPermission();
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      stopSupportAlertAudio(audioRef, audioPlayingRef);
      audioSourceRef.current?.disconnect();
      audioGainRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => undefined);
      audioRef.current = null;
      audioSourceRef.current = null;
      audioGainRef.current = null;
      audioContextRef.current = null;
    };
  }, [browserNotification.enabled, enabled]);

  const stopAlertSound = useCallback(() => {
    stopSupportAlertAudio(audioRef, audioPlayingRef);
  }, []);

  const playAlert = useCallback((event: SupportAssignmentAlertEvent) => {
    const audio = audioRef.current;
    if (audio) {
      const context = connectAmplifiedAudio(audio, audioContextRef, audioSourceRef, audioGainRef);
      const playAudio = () => {
        if (audioPlayingRef.current && !audio.paused) return;
        audio.loop = true;
        audio.currentTime = 0;
        void audio.play()
          .then(() => {
            audioPlayingRef.current = true;
          })
          .catch(() => {
            audioPlayingRef.current = false;
            playGeneratedAlertTone(audioContextRef);
          });
      };

      if (context) {
        void context.resume().then(playAudio).catch(playAudio);
      } else {
        playAudio();
      }
    } else {
      playGeneratedAlertTone(audioContextRef);
    }

    flashSupportAlertTitle(event, originalTitleRef);
    showBrowserNotification(event, browserNotification);
  }, [browserNotification]);

  const enqueueAlert = useCallback((event: SupportAssignmentAlertEvent) => {
    if (isSupportAlertAcknowledged(event.key)) return;

    setError(null);
    setPendingAlerts((current) => [
      event,
      ...current.filter((alert) => alert.key !== event.key && alert.ticket.id !== event.ticket.id)
    ].sort(compareSupportAlerts).slice(0, maxPendingAlerts));
    playAlert(event);
  }, [playAlert]);

  const removePendingAlert = useCallback((key: string) => {
    setPendingAlerts((current) => current.filter((alert) => alert.key !== key));
  }, []);

  const acceptAlert = useCallback((key: string) => {
    const event = pendingAlertsRef.current.find((alert) => alert.key === key);
    if (!event) return;

    acknowledgeSupportAlert(event.key);
    removePendingAlert(event.key);
    setError(null);

    if (typeof window !== "undefined") {
      window.location.assign(supportTicketHref(browserNotification.href, event.ticket.id));
    }
  }, [browserNotification.href, removePendingAlert]);

  const rejectAlert = useCallback(async (key: string) => {
    const event = pendingAlertsRef.current.find((alert) => alert.key === key);
    if (!event) return;

    setActionId(`reject:${event.key}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(event.ticket.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ assignedToUserId: null, status: "OPEN" })
      });
      if (!response.ok) throw new Error(await readSupportAlertActionError(response));

      acknowledgeSupportAlert(event.key);
      removePendingAlert(event.key);
      await refreshRef.current?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not reject ${ticketLabel(event.ticket)}.`);
    } finally {
      setActionId(null);
    }
  }, [removePendingAlert]);

  useEffect(() => {
    if (!enabled || pendingAlerts.length === 0) {
      stopAlertSound();
      return;
    }

    const interval = window.setInterval(() => {
      const nextAlert = pendingAlertsRef.current[0];
      if (nextAlert) playAlert(nextAlert);
    }, supportAlertRepeatMs);

    return () => window.clearInterval(interval);
  }, [enabled, pendingAlerts.length, playAlert, stopAlertSound]);

  useEffect(() => {
    if (!enabled || !currentUserId) {
      previousTicketsRef.current = new Map();
      primedRef.current = false;
      currentUserRef.current = currentUserId;
      const frame = window.requestAnimationFrame(() => setPendingAlerts([]));
      return () => window.cancelAnimationFrame(frame);
    }

    if (currentUserRef.current !== currentUserId) {
      previousTicketsRef.current = new Map();
      primedRef.current = false;
      currentUserRef.current = currentUserId;
    }

    const nextTickets = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const pruneFrame = window.requestAnimationFrame(() => {
      setPendingAlerts((current) => current.filter((alert) => shouldKeepPendingAlert(alert, nextTickets, currentUserId)));
    });

    if (!primedRef.current) {
      previousTicketsRef.current = nextTickets;
      primedRef.current = true;
      const firstWaitingAlert = tickets
        .map((ticket) => pendingCustomerMessageAlert(ticket, currentUserId))
        .filter((event): event is SupportAssignmentAlertEvent => event !== null && !isSupportAlertAcknowledged(event.key))
        .sort(compareSupportAlerts)[0];
      const alertFrame = firstWaitingAlert
        ? window.requestAnimationFrame(() => enqueueAlert(firstWaitingAlert))
        : null;
      return () => {
        window.cancelAnimationFrame(pruneFrame);
        if (alertFrame !== null) window.cancelAnimationFrame(alertFrame);
      };
    }

    const alertEvent = tickets.reduce<SupportAssignmentAlertEvent | null>((matchedEvent, ticket) => {
      if (matchedEvent) return matchedEvent;
      if (!isActiveAssignmentForUser(ticket, currentUserId)) return null;

      const previousTicket = previousTicketsRef.current.get(ticket.id);
      if (!previousTicket || !isActiveAssignmentForUser(previousTicket, currentUserId)) {
        return createSupportAlertEvent("assignment", ticket, latestCustomerMessage(ticket));
      }

      const currentCustomerMessage = latestCustomerMessage(ticket);
      const previousCustomerMessage = latestCustomerMessage(previousTicket);
      if (currentCustomerMessage && previousCustomerMessage && currentCustomerMessage.id !== previousCustomerMessage.id) {
        return createSupportAlertEvent("customer-message", ticket, currentCustomerMessage);
      }

      return null;
    }, null);

    previousTicketsRef.current = nextTickets;

    const alertFrame = alertEvent
      ? window.requestAnimationFrame(() => enqueueAlert(alertEvent))
      : null;
    return () => {
      window.cancelAnimationFrame(pruneFrame);
      if (alertFrame !== null) window.cancelAnimationFrame(alertFrame);
    };
  }, [currentUserId, enabled, enqueueAlert, tickets]);

  return {
    pendingAlerts,
    actionId,
    error,
    acceptAlert,
    rejectAlert
  };
}

function isActiveAssignmentForUser(ticket: SupportAssignmentAlertTicket, userId: string) {
  return ticket.assignedToUserId === userId && activeSupportChatStatuses.has(ticket.status);
}

function latestCustomerMessage(ticket: SupportAssignmentAlertTicket) {
  return ticket.messages
    ?.filter((message) => message.sender === "CUSTOMER")
    .at(-1) ?? null;
}

function latestAgentMessage(ticket: SupportAssignmentAlertTicket) {
  return ticket.messages
    ?.filter((message) => message.sender === "AGENT")
    .at(-1) ?? null;
}

function pendingCustomerMessageAlert(ticket: SupportAssignmentAlertTicket, userId: string) {
  if (!isActiveAssignmentForUser(ticket, userId)) return null;

  const customerMessage = latestCustomerMessage(ticket);
  if (!customerMessage) return null;

  const agentMessage = latestAgentMessage(ticket);
  if (agentMessage && Date.parse(agentMessage.createdAt) >= Date.parse(customerMessage.createdAt)) return null;

  return createSupportAlertEvent("customer-message", ticket, customerMessage);
}

function createSupportAlertEvent(
  kind: SupportAssignmentAlertKind,
  ticket: SupportAssignmentAlertTicket,
  message?: SupportAssignmentAlertMessage | null
): SupportAssignmentAlertEvent {
  const messageId = message?.id ?? ticket.lastMessageAt ?? ticket.assignedToUserId ?? "ticket";
  return {
    key: `${kind}:${ticket.id}:${messageId}`,
    kind,
    ticket,
    message: message ?? null,
    receivedAt: Date.now()
  };
}

function shouldKeepPendingAlert(
  alert: SupportAssignmentAlertEvent,
  tickets: Map<string, SupportAssignmentAlertTicket>,
  currentUserId: string
) {
  if (isSupportAlertAcknowledged(alert.key)) return false;

  const ticket = tickets.get(alert.ticket.id);
  if (!ticket || !isActiveAssignmentForUser(ticket, currentUserId)) return false;
  if (alert.kind !== "customer-message" || !alert.message) return true;

  const waitingAlert = pendingCustomerMessageAlert(ticket, currentUserId);
  return waitingAlert?.message?.id === alert.message.id;
}

function compareSupportAlerts(left: SupportAssignmentAlertEvent, right: SupportAssignmentAlertEvent) {
  return supportAlertTime(right) - supportAlertTime(left);
}

function supportAlertTime(event: SupportAssignmentAlertEvent) {
  return Date.parse(event.message?.createdAt ?? event.ticket.lastMessageAt ?? "") || event.receivedAt;
}

function ensureAudioContext(contextRef: MutableRefObject<AudioContext | null>) {
  if (contextRef.current || typeof window === "undefined") return contextRef.current;

  const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!AudioContextClass) return null;

  contextRef.current = new AudioContextClass();
  return contextRef.current;
}

function connectAmplifiedAudio(
  audio: HTMLAudioElement,
  contextRef: MutableRefObject<AudioContext | null>,
  sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>,
  gainRef: MutableRefObject<GainNode | null>
) {
  const context = ensureAudioContext(contextRef);
  if (!context) return null;

  if (!gainRef.current) {
    const gain = context.createGain();
    gain.gain.value = supportAssignmentAlertGain;
    gain.connect(context.destination);
    gainRef.current = gain;
  } else {
    gainRef.current.gain.value = supportAssignmentAlertGain;
  }

  if (!sourceRef.current) {
    try {
      const source = context.createMediaElementSource(audio);
      source.connect(gainRef.current);
      sourceRef.current = source;
    } catch {
      return null;
    }
  }

  return context;
}

function playGeneratedAlertTone(contextRef: MutableRefObject<AudioContext | null>) {
  const context = ensureAudioContext(contextRef);
  if (!context) return;

  void context.resume()
    .then(() => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(1046.5, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.36, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.38);
    })
    .catch(() => undefined);
}

function stopSupportAlertAudio(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
  playingRef: MutableRefObject<boolean>
) {
  const audio = audioRef.current;
  playingRef.current = false;
  if (!audio) return;

  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers throw if the media metadata is not ready yet.
  }
}

async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "default") return;
  await Notification.requestPermission().catch(() => "denied");
}

function showBrowserNotification(event: SupportAssignmentAlertEvent, options: BrowserNotificationOptions) {
  if (!options.enabled || typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;

  const title = event.kind === "customer-message" ? "New customer support message" : "Support chat connected";
  const body = event.kind === "customer-message"
    ? `${ticketLabel(event.ticket)}: ${trimNotificationText(event.message?.body ?? event.ticket.lastMessage ?? "Customer replied.")}`
    : `${ticketLabel(event.ticket)} is assigned to you.`;
  const notification = new Notification(title, {
    body,
    icon: "/icon.svg",
    tag: `support-${event.kind}-${event.ticket.id}`
  });

  notification.onclick = () => {
    window.focus();
    window.location.assign(supportTicketHref(options.href, event.ticket.id));
    notification.close();
  };

  window.setTimeout(() => notification.close(), 12000);
}

function flashSupportAlertTitle(event: SupportAssignmentAlertEvent, originalTitleRef: MutableRefObject<string | null>) {
  if (typeof document === "undefined") return;

  originalTitleRef.current ??= document.title;
  const prefix = event.kind === "customer-message" ? "New support message" : "Support connected";
  document.title = `${prefix} - ${originalTitleRef.current}`;

  window.setTimeout(() => {
    if (originalTitleRef.current) document.title = originalTitleRef.current;
  }, 9000);
}

function ticketLabel(ticket: SupportAssignmentAlertTicket) {
  return ticket.code || ticket.subject || ticket.businessName || "Support chat";
}

function trimNotificationText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function supportTicketHref(baseHref: string | undefined, ticketId: string) {
  const fallbackHref = baseHref || "/support";
  if (typeof window === "undefined") return `${fallbackHref}?ticket=${encodeURIComponent(ticketId)}`;

  const url = new URL(fallbackHref, window.location.origin);
  url.searchParams.set("ticket", ticketId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function isSupportAlertAcknowledged(key: string) {
  if (typeof window === "undefined") return false;
  return Boolean(readSupportAlertAckStore()[key]);
}

function acknowledgeSupportAlert(key: string) {
  if (typeof window === "undefined") return;

  const store = readSupportAlertAckStore();
  const entries = Object.entries({ ...store, [key]: Date.now() })
    .sort(([, left], [, right]) => Number(right) - Number(left))
    .slice(0, 80);
  window.localStorage.setItem(supportAlertAckStorageKey, JSON.stringify(Object.fromEntries(entries)));
}

function readSupportAlertAckStore(): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(supportAlertAckStorageKey) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number")
    );
  } catch {
    return {};
  }
}

async function readSupportAlertActionError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof payload?.error === "string" ? payload.error : `Support alert action failed with ${response.status}.`;
}
