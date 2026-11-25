"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMediaQuery, useMotionAllowed } from "./use-motion-allowed";

/** Gives its children a gentle 3D tilt that follows a mouse pointer (never on touch). */
export function TiltStage({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionAllowed = useMotionAllowed();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const enabled = motionAllowed && finePointer;
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 110, damping: 18, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 110, damping: 18, mass: 0.5 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className={cn("[perspective:1400px]", className)}>
      <motion.div className="relative h-full w-full [transform-style:preserve-3d]" style={enabled ? { rotateX, rotateY } : undefined}>
        {children}
      </motion.div>
    </div>
  );
}
