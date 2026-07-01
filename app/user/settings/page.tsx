import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { UserSettingsPage } from "@/components/user/user-portal-pages";
import { createMetadata } from "@/lib/seo";
import { getCustomerPortalBusinessProfiles, getCustomerPortalUser, requireCustomerSession } from "@/lib/user-portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "User Settings",
  description: "View your VyapaarMate user settings.",
  path: "/user/settings",
  noIndex: true
});

export default async function UserSettingsRoute() {
  const session = await requireCustomerSession("/user/settings");
  const user = await getCustomerPortalUser(session);
  const businessProfiles = await getCustomerPortalBusinessProfiles(user);

  return (
    <>
      <PublicHeader session={session} />
      <UserSettingsPage user={user} businessProfiles={businessProfiles} />
    </>
  );
}
