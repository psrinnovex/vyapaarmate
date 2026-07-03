"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionNoticeState = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

const noticeAutoCloseMsByTone: Record<NonNullable<ActionNoticeState>["tone"], number> = {
  success: 3600,
  warning: 5200,
  error: 6400
};
const noticeExitAnimationMs = 260;

export function ActionNotice({
  notice,
  onClose
}: {
  notice: ActionNoticeState;
  onClose: () => void;
}) {
  const noticeKey = notice ? `${notice.tone}:${notice.message}` : null;
  const noticeTone = notice?.tone ?? null;
  const [leavingNoticeKey, setLeavingNoticeKey] = useState<string | null>(null);
  const autoCloseTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const leaving = Boolean(noticeKey && leavingNoticeKey === noticeKey);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const clearTimers = useCallback(() => {
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const dismissNotice = useCallback(() => {
    if (!noticeKey || leavingRef.current) return;

    clearTimers();
    leavingRef.current = true;
    setLeavingNoticeKey(noticeKey);

    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      leavingRef.current = false;
      setLeavingNoticeKey(null);
      onCloseRef.current();
    }, noticeExitAnimationMs);
  }, [clearTimers, noticeKey]);

  useEffect(() => {
    clearTimers();
    leavingRef.current = false;

    if (noticeTone) {
      autoCloseTimerRef.current = window.setTimeout(dismissNotice, noticeAutoCloseMsByTone[noticeTone]);
    }

    return clearTimers;
  }, [clearTimers, dismissNotice, noticeKey, noticeTone]);

  if (!notice) return null;

  return (
    <div
      role="status"
      className={cn(
        "action-notice fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] z-[70] flex items-start gap-3 rounded-lg border p-4 text-sm font-semibold shadow-soft sm:inset-x-auto sm:bottom-5 sm:right-40 sm:max-w-sm lg:right-44",
        leaving && "action-notice-leaving",
        notice.tone === "success" && "border-emerald/20 bg-emerald text-white",
        notice.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        notice.tone === "error" && "border-red-200 bg-red-50 text-red-900"
      )}
    >
      <span className="leading-6">{notice.message}</span>
      <button
        type="button"
        aria-label="Close notification"
        className="grid size-6 shrink-0 place-items-center rounded-md transition hover:bg-white/20"
        onClick={dismissNotice}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ActionDialog({
  title,
  body,
  children,
  footer,
  className,
  onClose
}: {
  title: string;
  body?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex min-h-0 items-end justify-center overflow-hidden bg-ink/40 p-2 sm:items-center sm:p-4">
      <div className={cn("flex max-h-[calc(100svh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-soft sm:max-h-[calc(100svh-2rem)]", className)}>
        <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-0 sm:gap-4 sm:p-5 sm:pb-0">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold leading-7 text-ink sm:text-xl">{title}</h2>
            {body && <p className="mt-1 break-words text-sm leading-6 text-slate-500">{body}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-mist text-slate-600 transition hover:bg-slate-200 sm:size-9"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:mt-5 sm:px-5 sm:pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-white p-4 pt-3 sm:p-5 sm:pt-4">
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        </div>}
      </div>
    </div>
  );
}
