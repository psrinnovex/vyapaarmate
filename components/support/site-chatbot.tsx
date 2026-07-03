"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MutableRefObject, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lottie from "lottie-react";
import { Bot, Loader2, Send, ShieldCheck, Star, X } from "lucide-react";
import { company } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";

type ChatAction = {
  label: string;
  href: string;
  tone?: "primary" | "secondary" | "urgent";
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  actions?: ChatAction[];
  authorName?: string | null;
  authorInitials?: string | null;
};

type ChatbotApiResponse = {
  reply?: unknown;
  actions?: unknown;
  error?: unknown;
  supportTicket?: unknown;
};

type SupportTicketStatus = "OPEN" | "IN_REVIEW" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";

type SupportChatTicket = {
  id: string;
  code: string;
  subject: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: SupportTicketStatus;
  queuePosition: number | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedToInitials: string | null;
  feedback: { rating: number; comment: string | null; submittedAt: string } | null;
  messages: Array<{
    id: string;
    sender: "CUSTOMER" | "BOT" | "AGENT" | "SYSTEM";
    body: string;
    authorName: string | null;
    authorInitials: string | null;
    createdAt: string;
  }>;
};

type SupportChatApiResponse = {
  ticket?: unknown;
  error?: unknown;
};

type IncomingSupportAlert = {
  kind: "agent-message" | "agent-joined";
  ticket: SupportChatTicket;
  message?: SupportChatTicket["messages"][number] | null;
};

type AudioContextConstructor = typeof AudioContext;
type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: AudioContextConstructor;
};

type ChatPortal = "public" | "customer" | "business" | "support" | "admin";

type ChatPortalConfig = {
  portal: ChatPortal;
  starterPrompts: string[];
  welcomeMessage: ChatMessage;
};

const launcherAnimationPath = "/lottie/hello-chat-bot.json";
const customerSupportAlertPath = "/audio/support-agent-alert.mp3";
const customerSupportAlertGain = 2;
const storageKey = "vyapaarmate_chat_session";
const hiddenPathPrefixes = ["/login", "/register", "/forgot-password", "/dashboard", "/admin", "/support", "/b/", "/order/"];
const defaultChatHighlightTerms = [
  "VyapaarBot",
  `${company.product} Support`,
  company.product,
  company.name,
  company.name.replace(/\s+Pvt\s+Ltd$/i, ""),
  "PSHR",
  "Sri Hari",
  "Sri Sai Tiffins",
  "Fresh Bowl Cloud Kitchen",
  "Sweet Cravings Home Bakery"
];

export function SiteChatbot() {
  const pathname = usePathname();
  const shouldHide = useMemo(() => hiddenPathPrefixes.some((prefix) => pathname?.startsWith(prefix)), [pathname]);
  const portalConfig = useMemo(() => getPortalConfig(pathname), [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [portalConfig.welcomeMessage]);
  const [activeTicket, setActiveTicket] = useState<SupportChatTicket | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [animationData, setAnimationData] = useState<Record<string, unknown> | null>(null);
  const [unreadAgentMessages, setUnreadAgentMessages] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>("");
  const messageIdRef = useRef(0);
  const activeWelcomeIdRef = useRef(portalConfig.welcomeMessage.id);
  const activeTicketRef = useRef<SupportChatTicket | null>(activeTicket);
  const isOpenRef = useRef(isOpen);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const originalTitleRef = useRef<string | null>(null);
  const activeTicketId = activeTicket?.id;

  useEffect(() => {
    activeTicketRef.current = activeTicket;
  }, [activeTicket]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (shouldHide) return;

    sessionIdRef.current = getChatSessionId();

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, [shouldHide]);

  useEffect(() => {
    if (shouldHide) return;

    const audio = new Audio(customerSupportAlertPath);
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

      void connectSupportChatAudio(audio, audioContextRef, audioSourceRef, audioGainRef)
        ?.resume()
        .catch(() => undefined);
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      audio.pause();
      audioSourceRef.current?.disconnect();
      audioGainRef.current?.disconnect();
      audioRef.current = null;
      audioSourceRef.current = null;
      audioGainRef.current = null;
    };
  }, [shouldHide]);

  useEffect(() => {
    if (shouldHide || animationData) return;

    const controller = new AbortController();
    void fetch(launcherAnimationPath, { signal: controller.signal, cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload && typeof payload === "object") {
          setAnimationData(payload as Record<string, unknown>);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [animationData, shouldHide]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [activeTicket, isOpen, messages, prefersReducedMotion]);

  useEffect(() => {
    if (activeWelcomeIdRef.current === portalConfig.welcomeMessage.id) return;
    activeWelcomeIdRef.current = portalConfig.welcomeMessage.id;
    setMessages([portalConfig.welcomeMessage]);
    setDraft("");
  }, [portalConfig.welcomeMessage]);

  const playIncomingSupportAlert = useCallback((alert: IncomingSupportAlert) => {
    if (!isOpenRef.current) {
      setUnreadAgentMessages((count) => Math.min(99, count + 1));
    }

    const audio = audioRef.current;
    if (audio) {
      const context = connectSupportChatAudio(audio, audioContextRef, audioSourceRef, audioGainRef);
      const playAudio = () => {
        void audio.play().catch(() => playGeneratedSupportChatTone(audioContextRef));
      };

      audio.pause();
      audio.currentTime = 0;
      if (context) {
        void context.resume().then(playAudio).catch(playAudio);
      } else {
        playAudio();
      }
    } else {
      playGeneratedSupportChatTone(audioContextRef);
    }

    flashSupportChatTitle(alert, originalTitleRef);
    showSupportChatNotification(alert);
  }, []);

  useEffect(() => {
    if (!activeTicketId || shouldHide) return;

    const sessionId = sessionIdRef.current || getChatSessionId();
    const params = new URLSearchParams({ stream: "1", skipInitial: "1", sessionId });
    const source = new EventSource(`/api/support/chat/${encodeURIComponent(activeTicketId)}?${params.toString()}`);

    source.addEventListener("support-chat", (event) => {
      const payload = readSupportChatApiResponse(event.data);
      if (!payload.ticket) return;

      const alert = getIncomingSupportAlert(activeTicketRef.current, payload.ticket);
      if (alert) playIncomingSupportAlert(alert);
      activeTicketRef.current = payload.ticket;
      setActiveTicket(payload.ticket);
    });

    return () => source.close();
  }, [activeTicketId, playIncomingSupportAlert, shouldHide]);

  const chatHighlightTerms = useMemo(() => buildChatHighlightTerms(activeTicket), [activeTicket]);

  if (shouldHide) return null;

  const ticketClosed = activeTicket ? isClosedSupportTicket(activeTicket.status) : false;
  const displayMessages = activeTicket ? ticketMessagesToChatMessages(activeTicket) : messages;
  const chatTitle = activeTicket?.assignedToName ?? (activeTicket ? "Support queue" : "VyapaarBot");
  const chatSubtitle = activeTicket ? supportTicketSubtitle(activeTicket) : "Secure support";

  async function submitMessage(event?: FormEvent<HTMLFormElement>, overrideText?: string) {
    event?.preventDefault();

    const text = (overrideText ?? draft).replace(/\s+/g, " ").trim().slice(0, 600);
    if (!text || isSending || ticketClosed) return;

    if (activeTicket) {
      setDraft("");
      setIsSending(true);
      try {
        const response = await fetch(`/api/support/chat/${encodeURIComponent(activeTicket.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            body: text,
            sessionId: sessionIdRef.current || getChatSessionId()
          })
        });
        const payload = (await response.json().catch(() => ({}))) as SupportChatApiResponse;
        const ticket = readSupportTicket(payload.ticket);
        if (response.ok && ticket) {
          setActiveTicket(ticket);
        } else {
          setMessages((current) => [
            ...current,
            {
              id: nextMessageId("assistant"),
              role: "assistant",
              text: typeof payload.error === "string" ? payload.error : `I could not connect. Email ${company.supportEmail}.`
            }
          ]);
        }
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: nextMessageId("assistant"),
            role: "assistant",
            text: `I could not connect. Email ${company.supportEmail}.`
          }
        ]);
      } finally {
        setIsSending(false);
      }
      return;
    }

    const userMessage: ChatMessage = {
      id: nextMessageId("user"),
      role: "user",
      text
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          message: text,
          path: pathname,
          sessionId: sessionIdRef.current || getChatSessionId()
        })
      });

      const payload = (await response.json()) as ChatbotApiResponse;
      const assistantText = response.ok && typeof payload.reply === "string"
        ? payload.reply
        : typeof payload.error === "string"
          ? payload.error
          : `I could not answer. Email ${company.supportEmail}.`;

      setMessages((current) => [
        ...current,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          text: assistantText,
          actions: readActions(payload.actions)
        }
      ]);
      const ticketId = readSupportTicketId(payload.supportTicket);
      if (response.ok && ticketId) {
        await loadSupportTicket(ticketId);
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          text: `I could not connect. Email ${company.supportEmail}.`,
          actions: [{ label: "Email support", href: `mailto:${company.supportEmail}`, tone: "urgent" }]
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitMessage();
  }

  function nextMessageId(prefix: string) {
    messageIdRef.current += 1;
    return `${prefix}-${messageIdRef.current}`;
  }

  async function loadSupportTicket(ticketId: string) {
    const sessionId = sessionIdRef.current || getChatSessionId();
    const response = await fetch(`/api/support/chat/${encodeURIComponent(ticketId)}?sessionId=${encodeURIComponent(sessionId)}`, {
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as SupportChatApiResponse;
    const ticket = readSupportTicket(payload.ticket);
    if (response.ok && ticket) setActiveTicket(ticket);
  }

  async function submitFeedback(rating: number) {
    if (!activeTicket || feedbackSending) return;

    setFeedbackSending(true);
    try {
      const response = await fetch(`/api/support/chat/${encodeURIComponent(activeTicket.id)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          rating,
          comment: feedbackComment,
          sessionId: sessionIdRef.current || getChatSessionId()
        })
      });
      const payload = (await response.json().catch(() => ({}))) as SupportChatApiResponse;
      const ticket = readSupportTicket(payload.ticket);
      if (response.ok && ticket) {
        setActiveTicket(ticket);
        setFeedbackComment("");
      }
    } finally {
      setFeedbackSending(false);
    }
  }

  const launcherButtonClassName = "h-24 w-24 !bg-transparent sm:h-28 sm:w-28 lg:h-32 lg:w-32";
  const launcherVisualClassName =
    cn(
      "h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32",
      "!bg-transparent [&_*]:!bg-transparent [&_svg]:!overflow-visible [&_svg]:!bg-transparent"
    );

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-0 z-[65] flex justify-end sm:bottom-5 sm:right-2 lg:right-4"
    >
      {isOpen && (
        <section
          aria-label="VyapaarBot support chat"
          className={cn(
            "fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] top-[calc(env(safe-area-inset-top)+0.5rem)] flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_90px_rgba(13,19,33,0.25)] sm:inset-x-auto sm:top-auto sm:bottom-5 sm:right-5 sm:h-[min(680px,calc(100dvh-2.5rem))] sm:w-[380px]"
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-ink px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("grid size-14 shrink-0 place-items-center overflow-visible rounded-lg", activeTicket?.assignedToName ? "bg-emerald text-white" : "bg-transparent")}>
                {activeTicket?.assignedToName ? (
                  <span className="text-sm font-extrabold">{activeTicket.assignedToInitials ?? initials(activeTicket.assignedToName)}</span>
                ) : animationData ? (
                  <Lottie
                    animationData={animationData}
                    autoplay={!prefersReducedMotion}
                    loop={!prefersReducedMotion}
                    className="size-20 [&_svg]:!overflow-visible [&_svg]:!bg-transparent"
                  />
                ) : (
                  <Bot className="size-7 text-emerald" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{chatTitle}</p>
                <p className="flex items-center gap-1.5 text-xs text-white/65">
                  <ShieldCheck className="size-3.5" />
                  <span className="truncate">{chatSubtitle}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close support chat"
              title="Close"
              onClick={() => setIsOpen(false)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-mist/70 p-4">
            {displayMessages.map((message) => (
              <div key={message.id} className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : message.role === "system" ? "items-center" : "items-start")}>
                {message.role !== "system" && (
                  <div className={cn("flex max-w-[92%] items-center gap-2 sm:max-w-[86%]", message.role === "user" && "flex-row-reverse")}>
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold", message.role === "user" ? "bg-ink text-white" : "bg-emerald text-white")}>
                      {message.role === "user" ? "You" : message.authorInitials ?? "VM"}
                    </span>
                    <span className="truncate text-[11px] font-bold text-slate-500">{message.role === "user" ? "You" : message.authorName ?? "Support"}</span>
                  </div>
                )}
                <p
                  className={cn(
                    "w-fit max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 sm:max-w-[86%]",
                    message.role === "user"
                      ? "bg-ink text-white"
                      : message.role === "system"
                        ? "bg-transparent px-2 py-1 text-center text-xs font-bold text-slate-500"
                        : "border border-line bg-white text-slate-700"
                  )}
                >
                  {message.role === "user" ? message.text : renderChatMessageText(message.text, chatHighlightTerms, message.authorName)}
                </p>
                {message.actions && message.actions.length > 0 && (
                  <div className="flex max-w-[88%] flex-wrap gap-2 sm:max-w-[82%]">
                    {message.actions.map((action) => (
                      <a
                        key={`${message.id}-${action.href}-${action.label}`}
                        href={action.href}
                        className={cn(
                          "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-bold transition",
                          action.tone === "urgent"
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : action.tone === "primary"
                              ? "border-emerald/20 bg-emerald/10 text-emerald hover:bg-emerald/15"
                              : "border-line bg-white text-ink hover:border-ocean/30"
                        )}
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                <Loader2 className="size-4 animate-spin text-emerald" />
                {activeTicket ? "Sending" : "Replying"}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-line bg-white p-3">
            {ticketClosed ? (
              <div className="grid gap-3">
                {activeTicket?.feedback ? (
                  <div className="rounded-lg border border-emerald/20 bg-emerald/5 p-3 text-sm font-semibold text-emerald">
                    Feedback saved. Rating: {activeTicket.feedback.rating}/5.
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-bold text-ink">Rate your agent</p>
                    <textarea
                      value={feedbackComment}
                      maxLength={500}
                      rows={2}
                      onChange={(event) => setFeedbackComment(event.target.value)}
                      placeholder="Optional feedback"
                      className="min-h-12 resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm leading-5 outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10"
                    />
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          disabled={feedbackSending}
                          onClick={() => void submitFeedback(rating)}
                          className="grid h-10 place-items-center rounded-lg border border-line bg-mist text-amber-500 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Rate ${rating} out of 5`}
                          title={`${rating}/5`}
                        >
                          <span className="flex items-center gap-1 text-xs font-extrabold"><Star className="size-4 fill-current" />{rating}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {!activeTicket && (
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {portalConfig.starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isSending}
                  onClick={() => void submitMessage(undefined, prompt)}
                  className="h-9 rounded-lg border border-line bg-mist px-3 text-xs font-bold text-slate-700 transition hover:border-ocean/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
                    ))}
                  </div>
                )}
                <form className="flex items-end gap-2" onSubmit={(event) => void submitMessage(event)}>
                  <textarea
                    aria-label={activeTicket ? "Message support agent" : "Message VyapaarBot"}
                    value={draft}
                    maxLength={600}
                    rows={2}
                    onKeyDown={handleKeyDown}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={activeTicket ? (activeTicket.assignedToName ? "Message your agent" : "Add details for the agent") : "Ask a short question"}
                    className="h-14 min-h-14 max-h-28 flex-1 resize-none overflow-y-auto rounded-lg border border-line bg-white px-3 py-3 text-sm leading-5 outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10"
                  />
                  <button
                    type="submit"
                    aria-label="Send support message"
                    title="Send"
                    disabled={isSending || !draft.trim()}
                    className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald text-white shadow-glow transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}

      {!isOpen && (
        <div className={cn("flex translate-x-4 justify-end sm:translate-x-2 lg:translate-x-0", !prefersReducedMotion && "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]")}>
          <button
            type="button"
            aria-label="Open VyapaarBot"
            title="Open VyapaarBot"
            onClick={() => {
              setUnreadAgentMessages(0);
              setIsOpen(true);
            }}
            className={cn(
              "group relative grid place-items-center overflow-visible rounded-full border border-transparent !bg-transparent p-0 shadow-none drop-shadow-[0_18px_34px_rgba(13,19,33,0.24)] transition hover:-translate-y-0.5 hover:!bg-transparent hover:drop-shadow-[0_24px_46px_rgba(13,19,33,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald/60",
              launcherButtonClassName
            )}
          >
            {unreadAgentMessages > 0 && (
              <span className="absolute right-2 top-2 z-10 grid min-w-6 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-extrabold leading-5 text-white shadow-soft ring-2 ring-white">
                {unreadAgentMessages > 9 ? "9+" : unreadAgentMessages}
              </span>
            )}
            {animationData && (
              <Lottie
                animationData={animationData}
                autoplay={!prefersReducedMotion}
                loop={!prefersReducedMotion}
                className={launcherVisualClassName}
              />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function getChatSessionId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(storageKey);
  if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) return existing;

  const nextValue = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

  window.localStorage.setItem(storageKey, nextValue);
  return nextValue;
}

function readActions(value: unknown): ChatAction[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((action): ChatAction[] => {
    if (!action || typeof action !== "object") return [];
    const candidate = action as Partial<ChatAction>;
    if (typeof candidate.label !== "string" || typeof candidate.href !== "string") return [];
    if ((!candidate.href.startsWith("/") || candidate.href.startsWith("//")) && !candidate.href.startsWith("mailto:")) return [];

    return [{
      label: candidate.label.slice(0, 32),
      href: candidate.href,
      tone: candidate.tone === "primary" || candidate.tone === "urgent" ? candidate.tone : "secondary"
    }];
  }).slice(0, 3);
}

function readSupportChatApiResponse(data: string): { ticket: SupportChatTicket | null } {
  try {
    const parsed = JSON.parse(data) as SupportChatApiResponse;
    return { ticket: readSupportTicket(parsed.ticket) };
  } catch {
    return { ticket: null };
  }
}

function readSupportTicketId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { id?: unknown };
  return typeof candidate.id === "string" ? candidate.id : null;
}

function readSupportTicket(value: unknown): SupportChatTicket | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SupportChatTicket>;
  if (typeof candidate.id !== "string" || typeof candidate.code !== "string") return null;
  if (!isSupportTicketStatus(candidate.status) || !isSupportTicketPriority(candidate.priority)) return null;
  if (!Array.isArray(candidate.messages)) return null;

  return {
    id: candidate.id,
    code: candidate.code,
    subject: typeof candidate.subject === "string" ? candidate.subject : candidate.code,
    priority: candidate.priority,
    status: candidate.status,
    queuePosition: typeof candidate.queuePosition === "number" ? candidate.queuePosition : null,
    assignedToUserId: typeof candidate.assignedToUserId === "string" ? candidate.assignedToUserId : null,
    assignedToName: typeof candidate.assignedToName === "string" ? candidate.assignedToName : null,
    assignedToInitials: typeof candidate.assignedToInitials === "string" ? candidate.assignedToInitials : null,
    feedback: readSupportFeedback(candidate.feedback),
    messages: candidate.messages.flatMap((message) => readSupportMessage(message))
  };
}

function readSupportMessage(value: unknown): SupportChatTicket["messages"] {
  if (!value || typeof value !== "object") return [];
  const candidate = value as SupportChatTicket["messages"][number];
  if (typeof candidate.id !== "string" || typeof candidate.body !== "string" || typeof candidate.createdAt !== "string") return [];
  if (!["CUSTOMER", "BOT", "AGENT", "SYSTEM"].includes(candidate.sender)) return [];

  return [{
    id: candidate.id,
    sender: candidate.sender,
    body: candidate.body,
    authorName: typeof candidate.authorName === "string" ? candidate.authorName : null,
    authorInitials: typeof candidate.authorInitials === "string" ? candidate.authorInitials : null,
    createdAt: candidate.createdAt
  }];
}

function readSupportFeedback(value: unknown): SupportChatTicket["feedback"] {
  if (!value || typeof value !== "object") return null;
  const candidate = value as SupportChatTicket["feedback"];
  if (!candidate || typeof candidate.rating !== "number" || typeof candidate.submittedAt !== "string") return null;
  return {
    rating: candidate.rating,
    comment: typeof candidate.comment === "string" ? candidate.comment : null,
    submittedAt: candidate.submittedAt
  };
}

function buildChatHighlightTerms(ticket: SupportChatTicket | null) {
  const ticketAuthorNames = ticket?.messages.map((message) => message.authorName) ?? [];
  return normalizeChatHighlightTerms([
    ...defaultChatHighlightTerms,
    ticket?.assignedToName,
    ...ticketAuthorNames
  ]);
}

function renderChatMessageText(text: string, terms: string[], authorName?: string | null): ReactNode {
  const pattern = buildChatHighlightPattern([...terms, authorName]);
  if (!pattern) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const prefix = match[1] ?? "";
    const value = match[2] ?? "";
    const matchIndex = match.index ?? 0;
    const valueIndex = matchIndex + prefix.length;

    if (!value) continue;
    if (valueIndex > lastIndex) parts.push(text.slice(lastIndex, valueIndex));

    parts.push(
      <strong key={`${valueIndex}-${value.toLowerCase()}`} className="font-extrabold text-inherit">
        {value}
      </strong>
    );
    lastIndex = valueIndex + value.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

function buildChatHighlightPattern(terms: Array<string | null | undefined>) {
  const source = normalizeChatHighlightTerms(terms).map(escapeRegExp).join("|");
  return source ? new RegExp(`(^|[^A-Za-z0-9_])(${source})(?=$|[^A-Za-z0-9_])`, "gi") : null;
}

function normalizeChatHighlightTerms(terms: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const normalizedTerms: string[] = [];

  for (const value of terms) {
    const term = normalizeChatHighlightTerm(value);
    if (!term) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    normalizedTerms.push(term);
  }

  return normalizedTerms.sort((first, second) => second.length - first.length);
}

function normalizeChatHighlightTerm(value: string | null | undefined) {
  const term = value?.replace(/\s+/g, " ").trim();
  if (!term || term.length < 3) return null;
  if (/^(support|system|requester)$/i.test(term)) return null;
  return term;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ticketMessagesToChatMessages(ticket: SupportChatTicket): ChatMessage[] {
  return ticket.messages.map((message) => {
    if (message.sender === "SYSTEM") {
      return {
        id: message.id,
        role: "system",
        text: message.body
      };
    }

    if (message.sender === "CUSTOMER") {
      return {
        id: message.id,
        role: "user",
        text: message.body
      };
    }

    const authorName = message.sender === "BOT" ? "VyapaarBot" : message.authorName ?? ticket.assignedToName ?? "Support";
    return {
      id: message.id,
      role: "assistant",
      text: message.body,
      authorName,
      authorInitials: message.sender === "BOT" ? "VM" : message.authorInitials ?? (authorName ? initials(authorName) : "SP")
    };
  });
}

function getIncomingSupportAlert(previousTicket: SupportChatTicket | null, nextTicket: SupportChatTicket): IncomingSupportAlert | null {
  if (!previousTicket || previousTicket.id !== nextTicket.id) return null;

  const nextAgentMessage = latestAgentMessage(nextTicket);
  const previousAgentMessage = latestAgentMessage(previousTicket);
  if (nextAgentMessage && nextAgentMessage.id !== previousAgentMessage?.id) {
    return {
      kind: "agent-message",
      ticket: nextTicket,
      message: nextAgentMessage
    };
  }

  if (!previousTicket.assignedToUserId && nextTicket.assignedToUserId && nextTicket.assignedToName) {
    return {
      kind: "agent-joined",
      ticket: nextTicket
    };
  }

  return null;
}

function latestAgentMessage(ticket: SupportChatTicket) {
  return ticket.messages.filter((message) => message.sender === "AGENT").at(-1) ?? null;
}

function ensureSupportChatAudioContext(contextRef: MutableRefObject<AudioContext | null>) {
  if (contextRef.current || typeof window === "undefined") return contextRef.current;

  const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!AudioContextClass) return null;

  contextRef.current = new AudioContextClass();
  return contextRef.current;
}

function connectSupportChatAudio(
  audio: HTMLAudioElement,
  contextRef: MutableRefObject<AudioContext | null>,
  sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>,
  gainRef: MutableRefObject<GainNode | null>
) {
  const context = ensureSupportChatAudioContext(contextRef);
  if (!context) return null;

  if (!gainRef.current) {
    const gain = context.createGain();
    gain.gain.value = customerSupportAlertGain;
    gain.connect(context.destination);
    gainRef.current = gain;
  } else {
    gainRef.current.gain.value = customerSupportAlertGain;
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

function playGeneratedSupportChatTone(contextRef: MutableRefObject<AudioContext | null>) {
  const context = ensureSupportChatAudioContext(contextRef);
  if (!context) return;

  void context.resume()
    .then(() => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(784, now);
      oscillator.frequency.setValueAtTime(987.8, now + 0.1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.48, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.34);
    })
    .catch(() => undefined);
}

function flashSupportChatTitle(alert: IncomingSupportAlert, originalTitleRef: MutableRefObject<string | null>) {
  if (typeof document === "undefined") return;

  originalTitleRef.current ??= document.title;
  const prefix = alert.kind === "agent-message" ? "Support replied" : "Agent connected";
  document.title = `${prefix} - ${originalTitleRef.current}`;

  window.setTimeout(() => {
    if (originalTitleRef.current) document.title = originalTitleRef.current;
  }, 9000);
}

function showSupportChatNotification(alert: IncomingSupportAlert) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;

  const title = alert.kind === "agent-message" ? "Support replied" : "Agent connected to you";
  const notification = new Notification(title, {
    body: alert.kind === "agent-message"
      ? trimSupportChatNotificationText(alert.message?.body ?? "Your support agent sent a reply.")
      : `${alert.ticket.assignedToName ?? "Support"} connected to you.`,
    icon: "/icon.svg",
    tag: `customer-support-${alert.ticket.id}`
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  window.setTimeout(() => notification.close(), 12000);
}

function trimSupportChatNotificationText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function supportTicketSubtitle(ticket: SupportChatTicket) {
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    return ticket.feedback ? `${ticket.code} · feedback saved` : `${ticket.code} · feedback pending`;
  }
  if (ticket.assignedToName) return `${ticket.code} · ${ticket.assignedToName} connected`;
  if (ticket.queuePosition) return `${ticket.code} · queue #${ticket.queuePosition}`;
  return `${ticket.code} · waiting for agent`;
}

function isClosedSupportTicket(status: SupportTicketStatus) {
  return status === "RESOLVED" || status === "CLOSED";
}

function isSupportTicketStatus(value: unknown): value is SupportTicketStatus {
  return typeof value === "string" && ["OPEN", "IN_REVIEW", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"].includes(value);
}

function isSupportTicketPriority(value: unknown): value is SupportChatTicket["priority"] {
  return typeof value === "string" && ["LOW", "MEDIUM", "HIGH"].includes(value);
}

function getPortalConfig(pathname: string | null): ChatPortalConfig {
  const portal = inferPortal(pathname);

  if (portal === "admin") {
    return {
      portal,
      starterPrompts: ["Payout issue", "Business approval", "Subscription status", "WhatsApp approval"],
      welcomeMessage: {
        id: "welcome-admin",
        role: "assistant",
        text: "Hi, I'm VyapaarBot. I can help with payments, businesses, WhatsApp approvals, subscriptions, logs, or escalations.",
        actions: [
          { label: "Support", href: "/admin/support", tone: "primary" },
          { label: "Payments", href: "/admin/payments" }
        ]
      }
    };
  }

  if (portal === "support") {
    return {
      portal,
      starterPrompts: ["Open tickets", "Payment issue", "WhatsApp setup", "Account access"],
      welcomeMessage: {
        id: "welcome-support",
        role: "assistant",
        text: "Hi, I'm VyapaarBot. I can help with support escalations, customer follow-up, payments, WhatsApp setup, or account access.",
        actions: [
          { label: "Support", href: "/support", tone: "primary" },
          { label: "Email support", href: `mailto:${company.supportEmail}` }
        ]
      }
    };
  }

  if (portal === "business") {
    return {
      portal,
      starterPrompts: ["Catalog help", "Payment issue", "Customer CRM", "Reports"],
      welcomeMessage: {
        id: "welcome-business",
        role: "assistant",
        text: "Hi, I'm VyapaarBot. I can help with orders, bookings, catalog, payments, customers, campaigns, reports, or settings.",
        actions: [
          { label: "Orders / Bookings", href: "/dashboard/orders", tone: "primary" },
          { label: "Payments", href: "/dashboard/payments" }
        ]
      }
    };
  }

  if (portal === "customer") {
    if (isPathWithin(pathname, "/user")) {
      return {
        portal,
        starterPrompts: ["My bookings", "Payment issue", "Profile help", "Find businesses"],
        welcomeMessage: {
          id: "welcome-user",
          role: "assistant",
          text: "Hi, I'm VyapaarBot. I can help with your bookings, payments, profile, settings, or finding businesses.",
          actions: [
            { label: "Bookings", href: "/user/bookings", tone: "primary" },
            { label: "Profile", href: "/user/profile" }
          ]
        }
      };
    }

    return {
      portal,
      starterPrompts: ["Order or booking status", "Payment issue", "Contact business", "Store help"],
      welcomeMessage: {
        id: "welcome-customer",
        role: "assistant",
        text: "Hi, I'm VyapaarBot. I can help with order or booking status, payments, store details, or contacting the business.",
        actions: [
          { label: "Contact", href: "/contact", tone: "primary" },
          { label: "Demo store", href: "/b/sri-sai-tiffins" }
        ]
      }
    };
  }

  return {
    portal,
    starterPrompts: ["Pricing", "Book demo", "Payment help", "WhatsApp setup"],
    welcomeMessage: {
      id: "welcome-public",
      role: "assistant",
      text: "Hi, I'm VyapaarBot. I can help with pricing, demos, payments, WhatsApp, orders, or setup.",
      actions: [
        { label: "Features", href: "/features", tone: "primary" },
        { label: "Contact", href: "/contact" }
      ]
    }
  };
}

function inferPortal(pathname: string | null): ChatPortal {
  if (isPathWithin(pathname, "/support")) return "support";
  if (isPathWithin(pathname, "/admin")) return "admin";
  if (isPathWithin(pathname, "/dashboard")) return "business";
  if (isPathWithin(pathname, "/user") || isPathWithin(pathname, "/businesses") || isPathWithin(pathname, "/order") || isPathWithin(pathname, "/b")) {
    return "customer";
  }
  return "public";
}

function isPathWithin(pathname: string | null | undefined, prefix: string) {
  return pathname === prefix || pathname?.startsWith(`${prefix}/`) === true;
}
