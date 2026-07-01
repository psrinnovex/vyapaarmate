"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function AnalyticsPageView({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    window.gtag?.("config", measurementId, {
      page_path: pathname,
      anonymize_ip: true
    });
  }, [measurementId, pathname]);

  return null;
}
