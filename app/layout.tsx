import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { MarketingTags } from "@/components/marketing/marketing-tags";
import { RouteAwareSpeedInsights } from "@/components/marketing/route-aware-speed-insights";
import { LazySiteChatbot } from "@/components/support/lazy-site-chatbot";
import { SupportAgentAlerts } from "@/components/support/support-agent-alerts";
import { AppInstall } from "@/components/pwa/app-install";
import { DemoRibbon } from "@/components/demo/demo-ribbon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createMetadata, getSearchVerification } from "@/lib/seo";
import { launchSingleCityRestricted } from "@/lib/launch-policy";
import { company, getSiteOrigin, siteConfig } from "@/lib/site";
import "./globals.css";

// VyapaarMate type system (both SIL OFL, bundled locally so pages never wait on a font CDN):
// Inter for everything you read, Poppins by the Indian Type Foundry for headlines and prices.
const inter = localFont({
  src: [
    { path: "./fonts/Inter-Regular.woff", weight: "400", style: "normal" },
    { path: "./fonts/Inter-Medium.woff", weight: "500", style: "normal" },
    { path: "./fonts/Inter-SemiBold.woff", weight: "600", style: "normal" },
    { path: "./fonts/Inter-Bold.woff", weight: "700", style: "normal" }
  ],
  variable: "--font-inter-local",
  display: "swap",
  adjustFontFallback: "Arial"
});

const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Medium.woff", weight: "500", style: "normal" },
    { path: "./fonts/Poppins-Bold.woff", weight: "700", style: "normal" }
  ],
  variable: "--font-poppins-local",
  display: "swap",
  adjustFontFallback: "Arial"
});

export const metadata: Metadata = {
  ...createMetadata({ path: null }),
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: siteConfig.title,
    template: "%s | VyapaarMate"
  },
  applicationName: siteConfig.name,
  authors: [{ name: company.name, url: getSiteOrigin() }],
  creator: company.name,
  publisher: company.name,
  category: "Business Software",
  classification: "Local business software, WhatsApp commerce, UPI payments, CRM",
  referrer: "strict-origin-when-cross-origin",
  manifest: "/manifest.webmanifest",
  verification: getSearchVerification(),
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  other: {
    "geo.region": launchSingleCityRestricted ? "IN-KA" : "IN",
    "geo.placename": siteConfig.market,
    "mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: siteConfig.themeColor,
  colorScheme: "light"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.language} className={`${inter.variable} ${poppins.variable} scroll-smooth font-sans`} data-scroll-behavior="smooth">
      <body>
        <TooltipProvider>
          <MarketingTags />
          <SupportAgentAlerts />
          {children}
          <Suspense fallback={null}>
            <AppInstall />
          </Suspense>
          <LazySiteChatbot />
          <DemoRibbon />
          <RouteAwareSpeedInsights />
        </TooltipProvider>
      </body>
    </html>
  );
}
