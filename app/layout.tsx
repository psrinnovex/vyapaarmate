import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MarketingTags } from "@/components/marketing/marketing-tags";
import { LazySiteChatbot } from "@/components/support/lazy-site-chatbot";
import { SupportAgentAlerts } from "@/components/support/support-agent-alerts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createMetadata, getSearchVerification } from "@/lib/seo";
import { company, getSiteOrigin, siteConfig } from "@/lib/site";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"]
  },
  other: {
    "geo.region": "IN",
    "geo.placename": siteConfig.market,
    "mobile-web-app-capable": "yes"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: siteConfig.themeColor,
  colorScheme: "light"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.language} className={cn("scroll-smooth", "font-sans", geist.variable)} data-scroll-behavior="smooth">
      <body>
        <TooltipProvider>
          <MarketingTags />
          <SupportAgentAlerts />
          {children}
          <LazySiteChatbot />
          <SpeedInsights />
        </TooltipProvider>
      </body>
    </html>
  );
}
