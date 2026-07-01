import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLiveProvider } from "@/hooks/use-live-sync";
import { getSessionUser } from "@/lib/api-session";
import { getEmptyAdminPayload } from "@/lib/live-types";
import { createMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Admin",
  description: "VyapaarMate admin panel.",
  path: "/admin",
  noIndex: true
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (session.role === "SUPPORT_AGENT") {
    redirect("/support");
  }

  if (session.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <AdminLiveProvider initialPayload={getEmptyAdminPayload()} initialPayloadIsComplete={false}>
      <AdminShell role={session.role}>{children}</AdminShell>
    </AdminLiveProvider>
  );
}
