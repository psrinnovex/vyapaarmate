"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useTransform } from "framer-motion";
import { MessageCircle, QrCode, Share2 } from "lucide-react";
import { PhoneChatIllustration, SuccessIllustration, UpiQrIllustration } from "@/components/illustrations/clay-illustrations";
import { useScrollSteps } from "@/components/motion/scroll-steps";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";
import { cn } from "@/lib/utils";
import { PayScreen, PhoneMockup, ShopScreen, WhatsAppScreen } from "./phone-mockup";

const steps = [
  {
    title: "Share your shop link",
    body: "Post it on WhatsApp, Instagram or a QR poster.",
    Icon: Share2,
    orb: "bg-clay-green text-ink",
    Art: PhoneChatIllustration
  },
  {
    title: "Customer pays by UPI",
    body: "Scan, pay, done. Every payment is tracked.",
    Icon: QrCode,
    orb: "bg-clay-peacock text-white",
    Art: UpiQrIllustration
  },
  {
    title: "WhatsApp confirms it",
    body: "Live updates until the order reaches them.",
    Icon: MessageCircle,
    orb: "bg-clay-marigold text-ink",
    Art: SuccessIllustration
  }
];

/**
 * Scroll-telling: the stage pins for three screen-heights while the phone walks through
 * order → UPI payment → WhatsApp confirmation. Steps are also buttons that jump the page
 * to the matching scroll position, so it works with keyboard and screen readers too.
 */
export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const motionAllowed = useMotionAllowed();
  const { step, progress } = useScrollSteps(sectionRef, steps.length);
  const [paid, setPaid] = useState(false);
  const background = useTransform(progress, [0, 0.5, 1], ["#effbec", "#ecf7f7", "#fef8e8"]);
  const rail = useTransform(progress, [0, 1], [0.04, 1]);

  useMotionValueEvent(progress, "change", (value) => {
    const next = value * steps.length > 1.55;
    setPaid((current) => (current === next ? current : next));
  });

  function goTo(index: number) {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const travel = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((index + 0.5) / steps.length) * travel, behavior: motionAllowed ? "smooth" : "auto" });
  }

  return (
    <section ref={sectionRef} id="how-it-works" aria-labelledby="how-it-works-title" className="relative h-[300vh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <motion.div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundColor: background }} />
        <div aria-hidden="true" className="dotted-grid absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_70%_50%,black_20%,transparent_70%)]" />

        <div className="mx-auto grid w-full max-w-7xl items-center gap-5 px-4 pt-16 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pt-0">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-green-700 shadow-clay-sm">
              How it works
            </p>
            <h2 id="how-it-works-title" className="mt-3 text-[clamp(1.9rem,4.6vw,3.4rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink">
              Three steps. <span className="vm-mark">First order today.</span>
            </h2>

            <div className="mt-5 hidden h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/80 shadow-clay-inset lg:block">
              <motion.div className="h-full origin-left rounded-full bg-brand" style={{ scaleX: rail }} />
            </div>

            <ol className="mt-4 grid grid-cols-3 gap-2 lg:mt-6 lg:max-w-md lg:grid-cols-1 lg:gap-3">
              {steps.map(({ title, body, Icon, orb }, index) => {
                const active = index === step;
                return (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex w-full flex-col items-center gap-2 rounded-[1.4rem] border p-2.5 text-center transition-all duration-300 motion-reduce:transition-none lg:flex-row lg:items-start lg:gap-4 lg:p-4 lg:text-left",
                        active
                          ? "border-white bg-white shadow-clay lg:translate-x-2"
                          : "border-transparent bg-white/40 opacity-70 hover:opacity-100"
                      )}
                    >
                      <span className={cn("clay-orb size-10 shrink-0 rounded-2xl lg:size-12", orb)}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-extrabold leading-tight text-ink sm:text-xs lg:text-lg">
                          <span className="hidden text-ink-500 lg:inline">0{index + 1} · </span>
                          {title}
                        </span>
                        <span className={cn("mt-1 hidden text-sm leading-6 text-ink-500 lg:block", !active && "lg:hidden")}>{body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-center text-sm font-semibold text-ink-600 lg:hidden">{steps[step].body}</p>
          </div>

          <div className="relative flex justify-center">
            <div aria-hidden="true" className="absolute left-[2%] top-1/2 hidden w-[38%] -translate-y-1/2 sm:block lg:left-[-4%]">
              {steps.map(({ title, Art }, index) => (
                <div
                  key={title}
                  className={cn(
                    "absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all duration-500 ease-out motion-reduce:transition-none",
                    index === step ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  )}
                >
                  <Art />
                </div>
              ))}
            </div>
            <div className="relative aspect-[9/19] h-[min(58svh,36rem)]">
              <PhoneMockup>
                {[<ShopScreen key="shop" />, <PayScreen key="pay" paid={paid} />, <WhatsAppScreen key="wa" />].map((screen, index) => (
                  <div
                    key={index}
                    aria-hidden={index !== step}
                    className={cn(
                      "absolute inset-0 transition-all duration-500 ease-out motion-reduce:transition-none",
                      index === step ? "translate-y-0 scale-100 opacity-100" : index < step ? "-translate-y-6 scale-95 opacity-0" : "translate-y-6 scale-95 opacity-0"
                    )}
                  >
                    {screen}
                  </div>
                ))}
              </PhoneMockup>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
