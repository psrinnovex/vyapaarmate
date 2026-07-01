import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSessionUser } from "@/lib/api-session";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "VyapaarMate Support",
  description: "VyapaarMate Support portal.",
  path: "/support",
  noIndex: true
});

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login?type=support&next=/support");
  }

  if (session.role !== "SUPPORT_AGENT") {
    redirect(session.role === "SUPER_ADMIN" ? "/admin/support" : session.role === "CUSTOMER" ? "/user" : "/dashboard");
  }

  return <AdminShell role={session.role}>{children}</AdminShell>;
}
