"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/**
 * Number that counts up from zero the first time it scrolls into view. The server
 * render and reduced-motion users get the final value straight away.
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.4,
  className
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const started = useRef(false);

  const format = (value: number) =>
    `${prefix}${value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  // Before the first reveal, park the number at zero (only if it is still off-screen).
  useEffect(() => {
    const node = ref.current;
    if (!node || reduce || started.current) return;
    const rect = node.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.88) node.textContent = format(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduce || started.current) return;
    started.current = true;
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => {
        node.textContent = format(value);
      }
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, to]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(to)}
    </span>
  );
}
