"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * True only after mount and when the visitor has not asked the OS to reduce motion.
 * Scroll-linked effects key off this so the server render (and reduced-motion users)
 * always get the calm, static layout first.
 */
export function useMotionAllowed() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && reduce !== true;
}

/** Media-query hook that is `fallback` during SSR and the first client render. */
export function useMediaQuery(query: string, fallback = false) {
  const [matches, setMatches] = useState(fallback);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}
