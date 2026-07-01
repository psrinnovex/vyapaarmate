import type { Metadata } from "next";
import { BusinessesPage } from "@/components/businesses/businesses-page";
import { PublicHeader } from "@/components/layout/public-header";
import { createMetadata } from "@/lib/seo";
import { requireCustomerSession } from "@/lib/user-portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "User Portal",
  description: "Browse businesses and manage your VyapaarMate user portal.",
  path: "/user",
  noIndex: true
});

export default async function UserPortalHomeRoute() {
  const session = await requireCustomerSession("/user");

  return (
    <>
      <PublicHeader session={session} />
      <BusinessesPage showBusinessDays={false} showLocationRequiredAction={false} />
    </>
  );
}
