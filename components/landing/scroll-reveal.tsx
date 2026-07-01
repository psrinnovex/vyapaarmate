"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type RevealDirection = "up" | "down" | "left" | "right" | "none";

const offsets: Record<RevealDirection, { x: number; y: number }> = {
  up: { x: 0, y: 30 },
  down: { x: 0, y: -30 },
  left: { x: 30, y: 0 },
  right: { x: -30, y: 0 },
  none: { x: 0, y: 0 }
};

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up"
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: RevealDirection;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      node.style.opacity = "1";
      node.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    const rect = node.getBoundingClientRect();
    const isAlreadyInView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (isAlreadyInView) return;

    let cancelled = false;
    let cleanupReveal = () => {};

    void import("animejs").then(({ animate }) => {
      if (cancelled) return;

      const offset = offsets[direction];
      let hasAnimated = false;
      let animation: ReturnType<typeof animate> | null = null;

      node.style.opacity = "0";
      node.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      node.style.willChange = "opacity, transform";

      const reveal = () => {
        if (hasAnimated) {
          return;
        }

        hasAnimated = true;
        animation = animate(node, {
          opacity: [0, 1],
          translateX: [offset.x, 0],
          translateY: [offset.y, 0],
          duration: 820,
          delay,
          ease: "outCubic",
          onComplete: () => {
            node.style.willChange = "auto";
          }
        });
      };

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        },
        {
          rootMargin: "0px 0px -12% 0px",
          threshold: 0.12
        }
      );

      observer.observe(node);

      cleanupReveal = () => {
        animation?.cancel();
        observer.disconnect();
      };

      if (cancelled) cleanupReveal();
    });

    return () => {
      cancelled = true;
      cleanupReveal();
    };
  }, [delay, direction]);

  return (
    <div ref={ref} className={cn("translate-x-0 translate-y-0 opacity-100", className)}>
      {children}
    </div>
  );
}
