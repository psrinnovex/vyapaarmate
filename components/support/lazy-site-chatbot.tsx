"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";

const hiddenPathPrefixes = ["/login", "/register", "/forgot-password", "/dashboard", "/admin", "/support", "/b/", "/order/"];
const fallbackDelayMs = 1400;

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function LazySiteChatbot() {
  const pathname = usePathname();
  const shouldHide = useMemo(() => hiddenPathPrefixes.some((prefix) => pathname?.startsWith(prefix)), [pathname]);
  const [Chatbot, setChatbot] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (shouldHide || Chatbot) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    const loadChatbot = () => {
      void import("@/components/support/site-chatbot").then((module) => {
        if (!cancelled) {
          setChatbot(() => module.SiteChatbot);
        }
      });
    };

    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(loadChatbot, { timeout: 3200 });
    } else {
      timeoutId = window.setTimeout(loadChatbot, fallbackDelayMs);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [Chatbot, shouldHide]);

  if (shouldHide || !Chatbot) return null;

  return <Chatbot />;
}
