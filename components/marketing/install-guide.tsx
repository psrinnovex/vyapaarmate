"use client";

import { useState, useSyncExternalStore } from "react";
import { Laptop, MonitorSmartphone, Smartphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PlatformId = "ios" | "android" | "windows" | "mac";

const platforms: { id: PlatformId; name: string; icon: LucideIcon; device: "phone" | "laptop"; steps: string[] }[] = [
  {
    id: "ios",
    name: "iPhone and iPad",
    icon: Smartphone,
    device: "phone",
    steps: ["Open VyapaarMate in Safari", "Tap Share", "Choose Add to Home Screen", "Turn on Open as Web App", "Tap Add"]
  },
  {
    id: "android",
    name: "Android",
    icon: MonitorSmartphone,
    device: "phone",
    steps: ["Open VyapaarMate in Chrome or Edge", "Choose Install app from the browser prompt or menu"]
  },
  {
    id: "windows",
    name: "Windows desktop",
    icon: Laptop,
    device: "laptop",
    steps: ["Open VyapaarMate in Chrome or Edge", "Use the install icon in the address bar", "Or choose Install VyapaarMate from the menu"]
  },
  {
    id: "mac",
    name: "MacBook and Mac",
    icon: Laptop,
    device: "laptop",
    steps: ["In Safari on macOS Sonoma 14 or later, choose File > Add to Dock", "Chrome and Edge also provide an Install option"]
  }
];

const noopSubscribe = () => () => {};

function detectPlatform(): PlatformId | null {
  const agent = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(agent) || (/macintosh/i.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(agent)) return "android";
  if (/windows/i.test(agent)) return "windows";
  if (/macintosh|mac os x/i.test(agent)) return "mac";
  return null;
}

/** Device tabs with a mock screen of numbered steps; preselects the visitor's own platform. */
export function InstallGuide() {
  const detected = useSyncExternalStore(noopSubscribe, detectPlatform, () => null);
  const [choice, setChoice] = useState<PlatformId | null>(null);
  const activeId = choice ?? detected ?? "ios";
  const active = platforms.find((platform) => platform.id === activeId) ?? platforms[0];

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <div role="tablist" aria-label="Choose your device" className="grid grid-cols-2 gap-3">
          {platforms.map((platform) => {
            const selected = platform.id === active.id;
            return (
              <button
                key={platform.id}
                type="button"
                role="tab"
                id={`install-tab-${platform.id}`}
                aria-selected={selected}
                aria-controls="install-panel"
                onClick={() => setChoice(platform.id)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-[1.6rem] p-4 text-left transition",
                  selected ? "bg-clay-ink text-white shadow-clay-lg theme-dark" : "clay text-ink hover:-translate-y-0.5"
                )}
              >
                <span className={cn("clay-orb size-11 rounded-2xl", selected ? "bg-clay-green text-ink" : "bg-ivory-100 text-peacock-600")}>
                  <platform.icon className="size-5" />
                </span>
                <span className="text-sm font-extrabold leading-5">{platform.name}</span>
                {platform.id === detected && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", selected ? "bg-white/15 text-green-200" : "bg-green-50 text-green-700")}>
                    Your device
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div id="install-panel" role="tabpanel" aria-labelledby={`install-tab-${active.id}`} className="relative grid place-items-center">
        <div aria-hidden="true" className="vm-blob left-[15%] top-[10%] size-56 bg-marigold-400" />
        <div aria-hidden="true" className="vm-blob bottom-[5%] right-[12%] size-56 bg-brand" />
        <div
          key={active.id}
          className={cn(
            "relative motion-safe:animate-pop",
            active.device === "phone"
              ? "w-[17rem] rounded-[2.6rem] bg-clay-ink p-2.5 shadow-clay-lg theme-dark"
              : "w-full max-w-[30rem] rounded-[1.6rem] bg-clay-ink p-2.5 pb-3 shadow-clay-lg theme-dark"
          )}
        >
          <div className={cn("overflow-hidden bg-[linear-gradient(180deg,#fffdf8,#f3eee2)]", active.device === "phone" ? "min-h-[26rem] rounded-[2.1rem]" : "min-h-[17rem] rounded-[1.1rem]")}>
            <div className="flex items-center gap-1.5 px-4 pt-3">
              <span className="size-2 rounded-full bg-kumkum-700" />
              <span className="size-2 rounded-full bg-marigold-500" />
              <span className="size-2 rounded-full bg-brand" />
              <span className="ml-2 h-5 flex-1 rounded-full bg-white/90 px-2 text-[10px] font-bold leading-5 text-ink-500 shadow-clay-inset">vyapaarmate.com</span>
            </div>
            <ol className="grid gap-2.5 p-4">
              {active.steps.map((step, index) => (
                <li key={step} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm font-bold text-ink shadow-clay-sm motion-safe:animate-pop" style={{ animationDelay: `${index * 70}ms` }}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-clay-green text-xs font-extrabold text-ink">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          {active.device === "laptop" && <div aria-hidden="true" className="-mx-[5%] -mb-3 mt-2 h-2.5 rounded-b-2xl bg-[linear-gradient(180deg,#262a25,#0b0d0b)]" />}
        </div>
      </div>
    </div>
  );
}
