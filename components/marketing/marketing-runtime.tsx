"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

type MarketingMode = "gtm" | "ga4" | "none";
type MarketingEventValue = string | number | boolean | null | undefined;
type MarketingEventParams = Record<string, MarketingEventValue>;
type DataLayerItem = Record<string, unknown> | unknown[];
type AttributionParams = Record<string, string>;

const attributionStorageKey = "vyapaarmate_marketing_attribution";
const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

declare global {
  interface Window {
    dataLayer?: DataLayerItem[];
    gtag?: (...args: unknown[]) => void;
    __vyapaarmateMarketingMode?: MarketingMode;
  }
}

function cleanParams(params: MarketingEventParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function readAttribution(): AttributionParams {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.sessionStorage.getItem(attributionStorageKey);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === "string")
    ) as AttributionParams;
  } catch {
    return {};
  }
}

function writeAttribution(params: AttributionParams) {
  try {
    window.sessionStorage.setItem(attributionStorageKey, JSON.stringify(params));
  } catch {
    // Session storage can be unavailable in strict browser privacy modes.
  }
}

function captureAttribution() {
  if (typeof window === "undefined") return {};

  const urlParams = new URLSearchParams(window.location.search);
  const nextAttribution: AttributionParams = {};

  for (const key of attributionKeys) {
    const value = urlParams.get(key)?.trim();
    if (value) nextAttribution[key] = value.slice(0, 120);
  }

  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) {
        nextAttribution.referrer_host = referrer.hostname;
      }
    } catch {
      // Ignore malformed referrers from browser extensions or privacy tools.
    }
  }

  if (Object.keys(nextAttribution).length) {
    const merged = {
      ...readAttribution(),
      ...nextAttribution
    };
    writeAttribution(merged);
    return merged;
  }

  return readAttribution();
}

export function trackMarketingEvent(eventName: string, params: MarketingEventParams = {}) {
  if (typeof window === "undefined") return;

  const payload = cleanParams({
    ...readAttribution(),
    ...params
  });
  const mode = window.__vyapaarmateMarketingMode ?? "none";

  if (mode === "gtm") {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: eventName,
      ...payload
    });
    return;
  }

  if (mode === "ga4") {
    if (window.gtag) {
      window.gtag("event", eventName, payload);
      return;
    }

    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(["event", eventName, payload]);
  }
}

function readTrackingDataset(element: HTMLElement) {
  return cleanParams({
    event_category: element.dataset.marketingCategory,
    event_label: element.dataset.marketingLabel || element.textContent?.trim().slice(0, 80),
    cta_location: element.dataset.marketingLocation,
    destination: element.dataset.marketingDestination || element.getAttribute("href") || undefined,
    value: element.dataset.marketingValue ? Number(element.dataset.marketingValue) : undefined
  });
}

export function MarketingRuntime({
  mode,
  measurementId
}: {
  mode: MarketingMode;
  measurementId?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    window.__vyapaarmateMarketingMode = mode;
  }, [mode]);

  useEffect(() => {
    if (mode === "none") return;

    const attribution = captureAttribution();
    const pagePath = pathname || "/";
    const pagePayload = {
      ...attribution,
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title
    };

    if (mode === "ga4" && measurementId) {
      const config = {
        ...pagePayload,
        anonymize_ip: true
      };

      if (window.gtag) {
        window.gtag("config", measurementId, config);
      } else {
        window.dataLayer = window.dataLayer ?? [];
        window.dataLayer.push(["config", measurementId, config]);
      }
      return;
    }

    trackMarketingEvent("page_view", pagePayload);
  }, [measurementId, mode, pathname]);

  useEffect(() => {
    if (mode === "none") return;

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const trackingElement = target?.closest<HTMLElement>("[data-marketing-event]");
      if (!trackingElement) return;

      const eventName = trackingElement.dataset.marketingEvent?.trim();
      if (!eventName) return;

      trackMarketingEvent(eventName, readTrackingDataset(trackingElement));
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [mode]);

  useReportWebVitals((metric) => {
    if (mode === "none") return;

    trackMarketingEvent("web_vital", {
      metric_id: metric.id,
      metric_name: metric.name,
      metric_value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_delta: Math.round(metric.name === "CLS" ? metric.delta * 1000 : metric.delta),
      metric_rating: metric.rating,
      page_path: pathname || "/"
    });
  });

  return null;
}
