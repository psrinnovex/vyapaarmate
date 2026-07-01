"use client";

import type { Role } from "@prisma/client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { DashboardLiveProvider } from "@/hooks/use-live-sync";
import { DashboardBookingAlert } from "@/components/dashboard/dashboard-booking-alert";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { dashboardNav } from "@/lib/constants";
import { hasPermission } from "@/lib/rbac";
import type { LiveDashboardPayload } from "@/lib/live-types";
import { cn } from "@/lib/utils";

type DashboardBusiness = Pick<
  LiveDashboardPayload["business"],
  "id" | "name" | "slug" | "businessType" | "subscriptionPlan" | "subscriptionStatus" | "kycStatus" | "isActive" | "isVerified" | "setupCompletedAt"
>;

type BusinessAccessNotice = {
  message: string;
  href?: string;
  actionLabel?: string;
};

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function businessAccessNotice(business: DashboardBusiness) {
  if (!business.setupCompletedAt) {
    return {
      message: "Complete business setup before using the dashboard: owner details, business address, Google Maps location, and payout destination are required.",
      href: "/dashboard/setup",
      actionLabel: "Complete setup"
    };
  }
  if (business.subscriptionStatus !== "ACTIVE") {
    return {
      message: "Subscription payment is required before KYC upload, admin approval, and public customer access.",
      href: `/dashboard/billing/checkout?plan=${business.subscriptionPlan}`,
      actionLabel: "Pay subscription"
    };
  }
  if (!business.isVerified && business.kycStatus === "DOCUMENTS_PENDING") {
    return {
      message: "Upload all required KYC documents. Customers cannot access this business until PSHR admin approves KYC.",
      href: "/dashboard/setup#verification-documents",
      actionLabel: "Upload documents"
    };
  }
  if (!business.isVerified && business.kycStatus === "UNDER_REVIEW") {
    return {
      message: "KYC documents are under PSHR admin review. Customer access stays hidden until approval.",
      href: "/dashboard/setup",
      actionLabel: "View status"
    };
  }
  if (!business.isVerified && business.kycStatus === "REJECTED") {
    return {
      message: "KYC review was rejected. Upload corrected documents for another review.",
      href: "/dashboard/setup#verification-documents",
      actionLabel: "Fix documents"
    };
  }
  if (!business.isVerified) {
    return {
      message: "Pending PSHR admin approval. Customers cannot access this business service until PSHR admin approves it.",
      href: "/dashboard/setup",
      actionLabel: "View status"
    };
  }
  if (!business.isActive) {
    return {
      message: "This business is suspended. Customer access is paused until PSHR admin reactivates it."
    };
  }
  return null;
}

function ApprovalNotice({ notice }: { notice: BusinessAccessNotice }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
      <span>{notice.message}</span>
      {notice.href && notice.actionLabel && (
        <Link
          href={notice.href}
          className="inline-flex shrink-0 items-center font-bold text-ocean underline underline-offset-4 transition hover:text-ink"
        >
          {notice.actionLabel}
        </Link>
      )}
    </div>
  );
}

function permissionForNavItem(href: string) {
  if (href === "/dashboard") return "business:overview:read";
  if (href.startsWith("/dashboard/ai-suggestions")) return "business:reports:read";
  if (href.startsWith("/dashboard/orders")) return "business:orders:read";
  if (href.startsWith("/dashboard/menu")) return "business:menu:read";
  if (href.startsWith("/dashboard/customers")) return "business:customers:read";
  if (href.startsWith("/dashboard/coupons")) return "business:settings:write";
  if (href.startsWith("/dashboard/payments")) return "business:payments:read";
  if (href.startsWith("/dashboard/invoices")) return "business:payments:read";
  if (href.startsWith("/dashboard/campaigns")) return "business:customers:read";
  if (href.startsWith("/dashboard/staff")) return "business:staff:manage";
  if (href.startsWith("/dashboard/reports")) return "business:reports:read";
  if (href.startsWith("/dashboard/settings")) return "business:settings:write";
  if (href.startsWith("/dashboard/billing")) return "business:billing:read";
  return "business:overview:read";
}

export function DashboardShell({
  business,
  initialLivePayload,
  initialLivePayloadIsComplete = true,
  user,
  children
}: {
  business: DashboardBusiness;
  initialLivePayload: LiveDashboardPayload;
  initialLivePayloadIsComplete?: boolean;
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const copy = getBusinessConsoleCopy(business.businessType);
  const icons = getBusinessConsoleIcons(business.businessType);
  const StorefrontIcon = icons.businessIcon;
  const navItems = dashboardNav
    .filter((item) => hasPermission(user.role, permissionForNavItem(item.href)))
    .map((item) => {
      if (item.href === "/dashboard/orders") return { ...item, label: copy.transactionPlural, icon: icons.transactionIcon };
      if (item.href === "/dashboard/orders/history") return { ...item, label: `${copy.transactionSingular} History` };
      if (item.href === "/dashboard/menu") return { ...item, label: copy.catalogNavLabel, icon: icons.catalogIcon };
      if (item.href === "/dashboard/customers") return { ...item, label: copy.customerPlural, icon: icons.customerIcon };
      if (item.href === "/dashboard/staff") return { ...item, icon: icons.staffIcon };
      return item;
    });
  const isNavItemActive = (href: string) => {
    if (href === "/dashboard/orders") return pathname === href;
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  };
  const planLine = `${titleCase(business.subscriptionPlan)} plan - ${titleCase(business.subscriptionStatus)}`;
  const isSeededDemoUser = user.email.toLowerCase() === "owner@demo.com";
  const approvalNotice = user.role === "OWNER" ? businessAccessNotice(business) : null;

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div className="fixed inset-0 min-h-0 overflow-hidden bg-mist lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="hidden h-full min-h-0 overflow-hidden border-r border-line bg-white lg:block">
        <div className="flex h-full min-h-0 flex-col p-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg bg-ink p-3 font-bold text-white">
            <span className="grid size-10 place-items-center rounded-lg bg-white text-ink">VM</span>
            <span>VyapaarMate</span>
          </Link>
          {isSeededDemoUser && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Demo credentials must be changed before production.
            </div>
          )}
          <nav className="mt-5 grid min-h-0 flex-1 auto-rows-max gap-1 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const active = isNavItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                    active ? "bg-ocean text-white" : "text-slate-600 hover:bg-mist hover:text-ink"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-lg bg-mist p-3">
            <p className="truncate text-sm font-bold text-ink">{business.name}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{user.name} workspace</p>
          </div>
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-lg border border-line bg-white lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{business.name}</p>
              <p className="truncate text-xs text-slate-500">{planLine}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/b/${business.slug}`} className="hidden h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink sm:flex">
              <StorefrontIcon className="size-4" />
              Storefront
            </Link>
            <button
              type="button"
              aria-label="Log out"
              disabled={loggingOut}
              className="grid size-10 place-items-center rounded-lg border border-line bg-white text-slate-600 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={logout}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 bg-ink/40 p-4 lg:hidden">
            <div className="flex max-h-full min-h-0 w-full max-w-sm flex-col rounded-lg bg-white p-4 shadow-soft">
              <div className="flex shrink-0 items-center justify-between">
                <Link href="/" className="flex items-center gap-3 rounded-lg bg-ink p-3 font-bold text-white">
                  <span className="grid size-9 place-items-center rounded-lg bg-white text-ink">VM</span>
                  <span>VyapaarMate</span>
                </Link>
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="grid size-10 place-items-center rounded-lg border border-line bg-white text-slate-600"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="mt-5 grid min-h-0 flex-1 auto-rows-max gap-1 overflow-y-auto">
                {navItems.map((item) => {
                  const active = isNavItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                        active ? "bg-ocean text-white" : "text-slate-600 hover:bg-mist hover:text-ink"
                      )}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-5 shrink-0 rounded-lg bg-mist p-3">
                <p className="truncate text-sm font-bold text-ink">{business.name}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{user.name} workspace</p>
              </div>
            </div>
          </div>
        )}
        <DashboardLiveProvider initialPayload={initialLivePayload} initialPayloadIsComplete={initialLivePayloadIsComplete}>
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-6 sm:pb-6 lg:px-6">
            {approvalNotice && <ApprovalNotice notice={approvalNotice} />}
            <DashboardBookingAlert
              canReviewOrders={hasPermission(user.role, "business:orders:read")}
              canUpdateOrders={hasPermission(user.role, "business:orders:update")}
            />
            {children}
          </main>
        </DashboardLiveProvider>
      </div>
    </div>
  );
}
