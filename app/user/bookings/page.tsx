import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { UserBookingsPage } from "@/components/user/user-portal-pages";
import { createMetadata } from "@/lib/seo";
import { getCustomerPortalOrders, getCustomerPortalUser, requireCustomerSession } from "@/lib/user-portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "User Bookings",
  description: "View your VyapaarMate bookings in one place.",
  path: "/user/bookings",
  noIndex: true
});

export default async function UserBookingsRoute() {
  const session = await requireCustomerSession("/user/bookings");
  const user = await getCustomerPortalUser(session);
  const orders = await getCustomerPortalOrders(user);

  return (
    <>
      <PublicHeader session={session} />
      <UserBookingsPage user={user} orders={orders} />
    </>
  );
}
