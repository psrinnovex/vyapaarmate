"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Download, MonitorDown, Share, Smartphone, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  canOfferInstalledApp,
  detectInstallPlatform,
  isMobileInstallPlatform,
  type InstallPlatform
} from "@/lib/platform-access";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type SessionResponse = {
  user?: { role?: unknown } | null;
};

const dismissalKey = "vyapaarmate.install.dismissed.v2";

function installPromptDismissed() {
  try {
    return Boolean(window.localStorage.getItem(dismissalKey));
  } catch {
    return false;
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function installationHelp(platform: InstallPlatform) {
  if (platform === "ios") {
    return "In Safari, tap Share, choose “Add to Home Screen”, turn on “Open as Web App”, then tap Add.";
  }
  if (platform === "macos") {
    return "In Safari, choose File > Add to Dock. In Chrome or Edge, use Install VyapaarMate from the address bar or browser menu.";
  }
  if (platform === "android") {
    return "Open the browser menu and choose Install app or Add to Home screen.";
  }
  return "Use the install icon in the address bar, or choose Install VyapaarMate from your browser menu.";
}

export function AppInstall() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const searchKey = search ? `?${search}` : "";
  const locationKey = `${pathname}${searchKey}`;
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [eligibility, setEligibility] = useState<{
    locationKey: string;
    platform: InstallPlatform;
    allowed: boolean;
  } | null>(null);
  const [manualHelpKey, setManualHelpKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installedHandler = () => {
      setDismissed(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    const detectedPlatform = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
    const controller = new AbortController();
    let cancelled = false;

    if (isStandalone() || installPromptDismissed()) return () => controller.abort();

    async function resolveEligibility() {
      let role: string | null = null;
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });
        if (response.ok) {
          const payload = (await response.json()) as SessionResponse;
          role = typeof payload.user?.role === "string" ? payload.user.role : null;
        }
      } catch {
        // Installation eligibility fails closed until the server confirms a supported role.
      }

      if (cancelled) return;
      setEligibility({
        locationKey,
        platform: detectedPlatform,
        allowed: canOfferInstalledApp({ platform: detectedPlatform, role, pathname, search: searchKey })
      });
    }

    void resolveEligibility();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [locationKey, pathname, searchKey]);

  const platform = eligibility?.platform ?? "other";
  const eligible = eligibility?.locationKey === locationKey && eligibility.allowed;
  const manualHelpKeyForPage = `${locationKey}:${platform}`;

  useEffect(() => {
    if (!eligible || installPrompt) return;

    const timer = window.setTimeout(() => {
      setManualHelpKey(manualHelpKeyForPage);
    }, isMobileInstallPlatform(platform) ? 2500 : 3500);

    return () => window.clearTimeout(timer);
  }, [eligible, installPrompt, manualHelpKeyForPage, platform]);

  function dismiss() {
    try {
      window.localStorage.setItem(dismissalKey, "1");
    } catch {
      // The prompt can still be dismissed for this page when storage is unavailable.
    }
    setDismissed(true);
  }

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setDismissed(true);
    } finally {
      setInstallPrompt(null);
    }
  }

  const showManualHelp = manualHelpKey === manualHelpKeyForPage && !installPrompt;
  const visible = !dismissed && eligible && (Boolean(installPrompt) || showManualHelp);

  if (!visible) return null;

  const mobile = isMobileInstallPlatform(platform);
  const PlatformIcon = mobile ? Smartphone : MonitorDown;

  return (
    <aside className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[90] mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-950 p-4 text-white shadow-2xl sm:left-auto sm:right-5 sm:mx-0" aria-label="Install VyapaarMate app" aria-live="polite">
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Dismiss install suggestion"><X className="size-4" /></button>
      <div className="flex gap-3 pr-8">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald text-white"><PlatformIcon className="size-5" /></span>
        <div><p className="font-bold">Install VyapaarMate on this device</p><p className="mt-1 text-xs leading-5 text-white/65">Full-screen access to bookings, orders, payments, and your business workspace with the same secure website account.</p></div>
      </div>
      {showManualHelp && !installPrompt ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs leading-5"><Share className="mt-0.5 size-4 shrink-0" /> <span>{installationHelp(platform)}</span></div>
      ) : (
        <Button variant="emerald" className="mt-4 w-full" onClick={install}><Download className="size-4" /> Install app</Button>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] leading-4 text-white/55">
        <span>Phone installs are for users and business teams. Admin and support stay on web and desktop.</span>
        <ButtonLink href="/install" variant="link" className="shrink-0 text-white">Details</ButtonLink>
      </div>
    </aside>
  );
}
