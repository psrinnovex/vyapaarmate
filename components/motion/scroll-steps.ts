"use client";

import { useRef, useState, type RefObject } from "react";
import { useMotionValueEvent, useScroll, type MotionValue } from "framer-motion";

/**
 * Scroll-telling helper: while `target` (a tall section) scrolls past a pinned stage,
 * reports which of `count` steps is active plus the raw 0..1 progress motion value.
 * React state only changes when the step changes, never per frame.
 */
export function useScrollSteps(target: RefObject<HTMLElement | null>, count: number): {
  step: number;
  progress: MotionValue<number>;
} {
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  const last = useRef(0);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(count - 1, Math.max(0, Math.floor(value * count * 0.999)));
    if (next !== last.current) {
      last.current = next;
      setStep(next);
    }
  });

  return { step, progress: scrollYProgress };
}
