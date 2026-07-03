"use client";

import type { Role } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
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
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
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
  const mobileQuickNav = navItems
    .filter((item) =>
      ["/dashboard", "/dashboard/orders", "/dashboard/menu", "/dashboard/payments", "/dashboard/settings"].includes(item.href)
    )
    .slice(0, 5);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeMobileNav({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
      setMobileNavOpen(false);
      if (restoreFocus) window.requestAnimationFrame(() => mobileButtonRef.current?.focus());
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (mobilePanelRef.current?.contains(target) || mobileButtonRef.current?.contains(target)) return;
      closeMobileNav();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileNav();
        return;
      }

      if (event.key !== "Tab" || !mobilePanelRef.current) return;

      const focusableItems = Array.from(
        mobilePanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusableItems.length) return;

      const firstItem = focusableItems[0];
      const lastItem = focusableItems[focusableItems.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    function handleResize() {
      if (window.innerWidth >= 1024) closeMobileNav({ restoreFocus: false });
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    window.requestAnimationFrame(() => {
      mobilePanelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileNavOpen]);

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
              ref={mobileButtonRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="dashboard-mobile-navigation"
              className="grid size-10 place-items-center rounded-lg border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald/40 hover:text-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15 lg:hidden"
              onClick={() => setMobileNavOpen((value) => !value)}
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
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ink/45 backdrop-blur-md motion-safe:animate-[admin-mobile-backdrop-in_180ms_ease-out]"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              ref={mobilePanelRef}
              id="dashboard-mobile-navigation"
              className="dashboard-mobile-drawer safe-bottom relative flex h-full max-h-[100svh] w-[min(88vw,22.5rem)] flex-col overflow-hidden border-r border-line bg-white p-4 shadow-[34px_0_90px_rgba(13,19,33,0.24)] motion-safe:animate-[admin-mobile-drawer-in_340ms_cubic-bezier(0.22,1,0.36,1)]"
            >
              <div className="flex shrink-0 items-center justify-between">
                <Link href="/" className="flex items-center gap-3 rounded-lg bg-ink p-3 font-bold text-white">
                  <span className="grid size-9 place-items-center rounded-lg bg-white text-ink">VM</span>
                  <span>VyapaarMate</span>
                </Link>
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="grid size-10 place-items-center rounded-lg border border-line bg-white text-slate-600 transition hover:border-emerald/40 hover:text-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15"
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
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-12 min-w-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-emerald/15",
                        active ? "bg-ocean text-white shadow-[0_18px_42px_rgba(18,70,160,0.16)]" : "text-slate-600 hover:bg-mist hover:text-ink"
                      )}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", active ? "bg-white/15 text-white" : "bg-mist text-slate-500")}>
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
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
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-32 pt-6 sm:pb-6 lg:px-6">
            {approvalNotice && <ApprovalNotice notice={approvalNotice} />}
            <DashboardBookingAlert
              canReviewOrders={hasPermission(user.role, "business:orders:read")}
              canUpdateOrders={hasPermission(user.role, "business:orders:update")}
            />
            {children}
          </main>
          {mobileQuickNav.length > 0 && (
            <nav
              className="safe-bottom fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-lg border border-line bg-white/95 p-1 shadow-[0_20px_60px_rgba(13,19,33,0.18)] backdrop-blur-xl lg:hidden"
              aria-label="Dashboard quick navigation"
            >
              {mobileQuickNav.map((item) => {
                const active = isNavItemActive(item.href);
                return (
                  <Link
                    key={`${item.href}-quick`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-bold leading-none transition focus:outline-none focus:ring-4 focus:ring-emerald/15",
                      active ? "bg-ink text-white" : "text-slate-500 hover:bg-mist hover:text-ink"
                    )}
                  >
                    <item.icon className="size-4" />
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </DashboardLiveProvider>
      </div>
    </div>
  );
}
