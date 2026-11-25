"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform, type UseScrollOptions } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionAllowed } from "./use-motion-allowed";

type ScrollOffset = NonNullable<UseScrollOptions["offset"]>;

/**
 * Moves its children against the scroll at `speed` (px of travel per 100px scrolled,
 * roughly). Negative speeds float up faster than the page, positive ones lag behind.
 * Optional `rotate` and `scale` deltas are applied across the same range.
 *
 * `anchor="top"` measures from the page top (for hero objects that start in view);
 * the default measures while the element crosses the viewport.
 */
export function Parallax({
  children,
  speed = -0.2,
  rotate = 0,
  scale = 0,
  anchor = "viewport",
  className
}: {
  children: ReactNode;
  speed?: number;
  rotate?: number;
  scale?: number;
  anchor?: "viewport" | "top";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const motionAllowed = useMotionAllowed();
  const offset: ScrollOffset = anchor === "top" ? ["start start", "end start"] : ["start end", "end start"];
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const travel = speed * 400;
  const y = useTransform(progress, [0, 1], anchor === "top" ? [0, travel] : [-travel / 2, travel / 2]);
  const r = useTransform(progress, [0, 1], anchor === "top" ? [0, rotate] : [-rotate / 2, rotate / 2]);
  const s = useTransform(progress, [0, 1], anchor === "top" ? [1, 1 + scale] : [1 - scale / 2, 1 + scale / 2]);

  return (
    <motion.div
      ref={ref}
      className={cn("will-change-transform", className)}
      style={motionAllowed ? { y, rotate: r, scale: s } : undefined}
    >
      {children}
    </motion.div>
  );
}
