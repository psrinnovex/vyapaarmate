import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/support",
        "/support/",
        "/dashboard",
        "/dashboard/",
        "/user",
        "/user/",
        "/businesses",
        "/api/",
        "/order/",
        "/login",
        "/forgot-password",
        "/reset-password"
      ]
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteOrigin()
  };
}
