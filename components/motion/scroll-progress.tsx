"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionAllowed } from "./use-motion-allowed";

/** Thin logo-green bar pinned to the top edge that fills as the page scrolls. */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.3 });
  const motionAllowed = useMotionAllowed();

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-brand",
        className
      )}
      style={{ scaleX: motionAllowed ? smooth : scrollYProgress }}
    />
  );
}
