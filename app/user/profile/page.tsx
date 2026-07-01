import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { UserProfilePage } from "@/components/user/user-portal-pages";
import { createMetadata } from "@/lib/seo";
import { getCustomerPortalBusinessProfiles, getCustomerPortalOrders, getCustomerPortalUser, requireCustomerSession } from "@/lib/user-portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "User Profile",
  description: "View your VyapaarMate user profile.",
  path: "/user/profile",
  noIndex: true
});

export default async function UserProfileRoute() {
  const session = await requireCustomerSession("/user/profile");
  const user = await getCustomerPortalUser(session);
  const [orders, businessProfiles] = await Promise.all([
    getCustomerPortalOrders(user),
    getCustomerPortalBusinessProfiles(user)
  ]);

  return (
    <>
      <PublicHeader session={session} />
      <UserProfilePage user={user} orders={orders} businessProfiles={businessProfiles} />
    </>
  );
}
