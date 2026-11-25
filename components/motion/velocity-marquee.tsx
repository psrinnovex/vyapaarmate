"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity
} from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionAllowed } from "./use-motion-allowed";

const wrap = (min: number, max: number, value: number) => {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
};

/**
 * Endless strip that drifts on its own and speeds up (or reverses) with the page's
 * scroll velocity. It pauses when off-screen and stays still for reduced motion.
 */
export function VelocityMarquee({
  children,
  baseVelocity = -2.4,
  className
}: {
  children: ReactNode;
  baseVelocity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const motionAllowed = useMotionAllowed();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(baseX, (value) => `${wrap(-25, -50, value)}%`);
  const direction = useRef(1);

  useAnimationFrame((_, delta) => {
    if (!motionAllowed || !inView) return;
    let moveBy = direction.current * baseVelocity * (delta / 1000);
    const factor = velocityFactor.get();
    if (factor < 0) direction.current = -1;
    else if (factor > 0) direction.current = 1;
    moveBy += direction.current * moveBy * factor;
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.div className="flex w-max" style={{ x: motionAllowed ? x : "-25%" }}>
        {[0, 1, 2, 3].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy > 0 ? true : undefined}>
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
