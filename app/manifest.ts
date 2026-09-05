import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.shortDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eef4f8",
    theme_color: siteConfig.themeColor,
    categories: ["business", "productivity", "shopping"],
    icons: [
      {
        src: "/brand/vyapaarmate-logo-light.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
