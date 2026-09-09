import type { Metadata } from "next";
import { AccountDeletionPageContent } from "@/components/account-deletion/account-deletion-page";
import { MobileLegalShell } from "@/components/legal/mobile-legal-shell";
import { getSessionUser } from "@/lib/api-session";
import {
  BUSINESS_ACCOUNT_DELETE_CONFIRMATION
} from "@/lib/account-deletion";
import { CUSTOMER_ACCOUNT_DELETE_CONFIRMATION } from "@/lib/customer-account-copy";
import { createMetadata } from "@/lib/seo";

const description = "Request deletion of a VyapaarMate customer, staff, or business account and associated personal data.";

export const metadata: Metadata = {
  ...createMetadata({
    title: "Account Deletion",
    description,
    path: "/account-deletion",
    keywords: ["VyapaarMate account deletion", "delete VyapaarMate account"]
  }),
  referrer: "no-referrer"
};

export const dynamic = "force-dynamic";

export default async function AccountDeletionPage() {
  const session = await getSessionUser();

  return (
    <MobileLegalShell activePath="/account-deletion">
      <AccountDeletionPageContent
        session={session ? { name: session.name, email: session.email, role: session.role } : null}
        personalConfirmation={CUSTOMER_ACCOUNT_DELETE_CONFIRMATION}
        businessConfirmation={BUSINESS_ACCOUNT_DELETE_CONFIRMATION}
      />
    </MobileLegalShell>
  );
}
