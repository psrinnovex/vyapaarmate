"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMediaQuery, useMotionAllowed } from "./use-motion-allowed";

/**
 * On wide screens the section pins while vertical scrolling slides the track sideways.
 * On phones, for reduced motion, and in the server render it is a normal swipeable row
 * with scroll-snap, so nothing is ever unreachable.
 */
export function HorizontalScroll({
  children,
  header,
  className,
  trackClassName
}: {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  trackClassName?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const motionAllowed = useMotionAllowed();
  const wide = useMediaQuery("(min-width: 1024px)");
  const pinned = motionAllowed && wide;
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (!pinned) return;
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pinned]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.35 });
  const x = useTransform(smooth, [0, 1], [0, -distance]);

  return (
    <section
      ref={sectionRef}
      className={cn("relative", className)}
      style={pinned ? { height: `calc(100vh + ${distance}px)` } : undefined}
    >
      <div className={cn(pinned && "sticky top-0 flex h-screen flex-col justify-center overflow-hidden")}>
        {header}
        <motion.div
          ref={trackRef}
          style={pinned ? { x } : undefined}
          className={cn(
            "flex w-max gap-4 px-4 sm:gap-5 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]",
            !pinned && "w-auto snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            trackClassName
          )}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}
