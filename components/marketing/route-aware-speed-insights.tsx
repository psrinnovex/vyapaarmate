"use client";

import { usePathname } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function RouteAwareSpeedInsights() {
  const pathname = usePathname();
  if (pathname === "/account-deletion" || pathname?.startsWith("/mobile/") === true) return null;
  return <SpeedInsights />;
}
