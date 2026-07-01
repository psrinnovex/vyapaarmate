"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type LottieProps = {
  animationData: Record<string, unknown>;
  autoplay?: boolean;
  loop?: boolean;
  rendererSettings?: { preserveAspectRatio?: string };
  className?: string;
};

type LottieComponent = ComponentType<LottieProps>;
type LoadedAnimation = {
  src: string;
  data: Record<string, unknown>;
  Lottie: LottieComponent;
};

const animationCache = new Map<string, Promise<Record<string, unknown> | null>>();
let lottieComponentRequest: Promise<LottieComponent> | null = null;

function loadAnimationData(src: string) {
  const existing = animationCache.get(src);
  if (existing) return existing;

  const request = fetch(src, { cache: "force-cache" })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => (payload && typeof payload === "object" ? payload as Record<string, unknown> : null))
    .catch(() => null);

  animationCache.set(src, request);
  return request;
}

function loadLottieComponent() {
  lottieComponentRequest ??= import("lottie-react").then((module) => module.default as LottieComponent);
  return lottieComponentRequest;
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

export function LazyLottieAnimation({
  src,
  label,
  fallback,
  className,
  animationClassName,
  loop = true,
  autoplay = true,
  preserveAspectRatio = "xMidYMid meet"
}: {
  src?: string | null;
  label: string;
  fallback: ReactNode;
  className?: string;
  animationClassName?: string;
  loop?: boolean;
  autoplay?: boolean;
  preserveAspectRatio?: string;
}) {
  const [animation, setAnimation] = useState<LoadedAnimation | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!src) return;

    let mounted = true;
    void Promise.all([loadAnimationData(src), loadLottieComponent()]).then(([payload, Lottie]) => {
      if (mounted) setAnimation(payload ? { src, data: payload, Lottie } : null);
    });

    return () => {
      mounted = false;
    };
  }, [src]);

  const Lottie = animation?.Lottie;
  const ready = Boolean(src && animation?.src === src && Lottie);

  return (
    <div className={cn("grid place-items-center overflow-hidden", className)} role="img" aria-label={label}>
      {ready && Lottie ? (
        <Lottie
          animationData={animation.data}
          autoplay={autoplay && !reducedMotion}
          loop={loop && !reducedMotion}
          rendererSettings={{ preserveAspectRatio }}
          className={cn("size-full", animationClassName)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
