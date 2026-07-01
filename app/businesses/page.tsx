import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessesPage } from "@/components/businesses/businesses-page";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { getSessionUser } from "@/lib/api-session";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Businesses Near You",
  description:
    "Find active VyapaarMate restaurants, tiffin centers, cloud kitchens, salons, retailers, and local businesses, then view menus, services, products, or classes.",
  path: "/businesses",
  keywords: ["businesses near you", "restaurants on VyapaarMate", "local business ordering India", "WhatsApp enabled businesses"],
  noIndex: true
});

export default async function PublicBusinessesRoute() {
  const session = await getSessionUser();
  if (!session) redirect(`/login?next=${encodeURIComponent("/businesses")}`);

  return (
    <>
      <PublicHeader session={session} />
      <BusinessesPage />
      <PublicFooter />
    </>
  );
}
