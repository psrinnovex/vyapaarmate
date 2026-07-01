import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/seo";
import { getDashboardShellPayload, LiveDataNotFoundError } from "@/lib/live-data";
import { getSessionUser } from "@/lib/api-session";
import { hasPermission } from "@/lib/rbac";
import type { LiveDashboardPayload } from "@/lib/live-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Dashboard",
  description: "VyapaarMate business dashboard.",
  path: "/dashboard",
  noIndex: true
});

function permissionForPath(pathname: string) {
  if (pathname.startsWith("/dashboard/ai-suggestions")) return "business:reports:read";
  if (pathname.startsWith("/dashboard/orders")) return "business:orders:read";
  if (pathname.startsWith("/dashboard/menu")) return "business:menu:read";
  if (pathname.startsWith("/dashboard/customers")) return "business:customers:read";
  if (pathname.startsWith("/dashboard/coupons")) return "business:settings:write";
  if (pathname.startsWith("/dashboard/payments")) return "business:payments:read";
  if (pathname.startsWith("/dashboard/invoices")) return "business:payments:read";
  if (pathname.startsWith("/dashboard/campaigns")) return "business:customers:read";
  if (pathname.startsWith("/dashboard/reports")) return "business:reports:read";
  if (pathname.startsWith("/dashboard/setup")) return "business:settings:write";
  if (pathname.startsWith("/dashboard/settings")) return "business:settings:write";
  if (pathname.startsWith("/dashboard/staff")) return "business:staff:manage";
  if (pathname.startsWith("/dashboard/billing")) return "business:billing:read";
  return "business:overview:read";
}

function firstAllowedDashboardPath(role: Role) {
  const candidates = [
    ["/dashboard", "business:overview:read"],
    ["/dashboard/ai-suggestions", "business:reports:read"],
    ["/dashboard/orders", "business:orders:read"],
    ["/dashboard/menu", "business:menu:read"],
    ["/dashboard/customers", "business:customers:read"],
    ["/dashboard/coupons", "business:settings:write"],
    ["/dashboard/payments", "business:payments:read"],
    ["/dashboard/invoices", "business:payments:read"],
    ["/dashboard/billing", "business:billing:read"],
    ["/dashboard/reports", "business:reports:read"],
    ["/dashboard/settings", "business:settings:write"]
  ] as const;

  return candidates.find(([, permission]) => hasPermission(role, permission))?.[0] ?? "/login?next=/dashboard";
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login?next=/dashboard");
  }

  if (!session.businessId) {
    redirect(session.role === "SUPER_ADMIN" ? "/admin" : session.role === "SUPPORT_AGENT" ? "/support" : session.role === "CUSTOMER" ? "/user" : "/login?next=/dashboard");
  }

  let initialLivePayload: LiveDashboardPayload;
  try {
    initialLivePayload = await getDashboardShellPayload(session.businessId);
  } catch (error) {
    if (error instanceof LiveDataNotFoundError) {
      redirect("/login?next=/dashboard");
    }
    throw error;
  }

  const business = initialLivePayload.business;
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onSetupPage = pathname === "/dashboard/setup" || pathname.startsWith("/dashboard/setup/");

  if (!business.setupCompletedAt && !onSetupPage) {
    redirect(hasPermission(session.role, "business:settings:write") ? "/dashboard/setup" : "/login?next=/dashboard");
  }

  if (!hasPermission(session.role, permissionForPath(pathname))) {
    redirect(firstAllowedDashboardPath(session.role));
  }

  return (
    <DashboardShell
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        businessType: business.businessType,
        subscriptionPlan: business.subscriptionPlan,
        subscriptionStatus: business.subscriptionStatus,
        kycStatus: business.kycStatus,
        isActive: business.isActive,
        isVerified: business.isVerified,
        setupCompletedAt: business.setupCompletedAt
      }}
      initialLivePayload={initialLivePayload}
      initialLivePayloadIsComplete={false}
      user={{ name: session.name, email: session.email, role: session.role }}
    >
      {children}
    </DashboardShell>
  );
}
