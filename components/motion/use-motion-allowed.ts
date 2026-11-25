"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true on the client afterwards. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * True only after hydration and when the visitor has not asked the OS to reduce motion.
 * Scroll-linked effects key off this so the server render (and reduced-motion users)
 * always get the calm, static layout first.
 */
export function useMotionAllowed() {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return hydrated && reduce !== true;
}

/** Media-query hook that returns `fallback` during the server render and hydration. */
export function useMediaQuery(query: string, fallback = false) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback
  );
}
