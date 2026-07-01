"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Element3, Logout, ShieldTick } from "@/components/ui/iconsax";
import { CalendarCheck2, Home, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type PublicAuthActionsProps = {
  isAuthenticated: boolean;
  workspaceHref: string;
  workspaceLabel: string;
  isAdmin: boolean;
  isCustomer?: boolean;
  isHeaderScrolled?: boolean;
};

const userMenuItems = [
  { href: "/user", label: "Dashboard / Home", icon: Home },
  { href: "/user/bookings", label: "Bookings", icon: CalendarCheck2 },
  { href: "/user/settings", label: "Settings", icon: Settings },
  { href: "/user/profile", label: "Profile", icon: UserRound }
];

export function PublicAuthActions({
  isAuthenticated,
  workspaceHref,
  workspaceLabel,
  isAdmin,
  isCustomer = false,
  isHeaderScrolled = false
}: PublicAuthActionsProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const WorkspaceIcon = isAdmin ? ShieldTick : Element3;

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  if (isAuthenticated) {
    if (isCustomer) {
      return (
        <div ref={menuRef} className="relative flex shrink-0 items-center">
          <button
            type="button"
            aria-label="Open user portal menu"
            aria-expanded={menuOpen}
            aria-controls="user-portal-menu"
            onClick={() => setMenuOpen((value) => !value)}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg border transition hover:border-emerald/40 hover:text-emerald",
              isHeaderScrolled ? "border-white/15 bg-white/10 text-white" : "border-line bg-white text-ink shadow-sm"
            )}
          >
            <Menu className="size-5" />
          </button>
          {menuOpen && (
            <div
              id="user-portal-menu"
              className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-line bg-white shadow-[0_18px_55px_rgba(15,23,42,0.18)]"
            >
              <div className="border-b border-line px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">User Portal</p>
                <p className="mt-1 text-sm font-bold text-ink">Account Menu</p>
              </div>
              <div className="p-2">
                {userMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/user" && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                        active ? "bg-ink text-white" : "text-slate-700 hover:bg-mist hover:text-ink"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="border-t border-line p-2">
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={logout}
                  className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="size-4 shrink-0" />
                  <span>{loggingOut ? "Logging out" : "Logout"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={workspaceHref}
          aria-label={workspaceLabel}
          title={workspaceLabel}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-white transition hover:-translate-y-0.5",
            isHeaderScrolled ? "bg-emerald shadow-glow hover:bg-emerald/90" : "bg-ink shadow-soft hover:bg-emerald"
          )}
          data-marketing-event="navigation_click"
          data-marketing-location="public_header"
          data-marketing-label={workspaceLabel}
          data-marketing-destination={workspaceHref}
        >
          <WorkspaceIcon className="size-5 shrink-0" variant="Bulk" />
          <span className="hidden min-[390px]:inline sm:hidden">Open</span>
          <span className="hidden sm:inline">{workspaceLabel}</span>
        </Link>
        <button
          type="button"
          aria-label="Log out"
          title="Log out"
          disabled={loggingOut}
          onClick={logout}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg border transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60",
            isHeaderScrolled ? "border-white/15 bg-white/10 text-white/75" : "border-line bg-white text-slate-600"
          )}
        >
          <Logout className="size-5" variant="Bulk" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/login?type=user&next=%2Fbusinesses"
        aria-label="Login to view more businesses"
        title="Login to view more businesses"
        className={cn(
          "hidden h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-emerald/40 sm:inline-flex",
          isHeaderScrolled ? "border-white/15 bg-white/10 text-white/80 hover:text-white" : "border-line bg-white text-slate-700 hover:text-ink"
        )}
        data-marketing-event="cta_click"
        data-marketing-location="public_header"
        data-marketing-label="view_more"
        data-marketing-destination="/login?type=user&next=%2Fbusinesses"
      >
        <span className="hidden sm:inline">View More</span>
      </Link>
      <Link
        href="/register"
        aria-label="Register"
        title="Register"
        className={cn(
          "hidden h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 sm:inline-flex",
          isHeaderScrolled ? "bg-emerald shadow-glow hover:bg-emerald/90" : "bg-ink shadow-soft hover:bg-emerald"
        )}
        data-marketing-event="cta_click"
        data-marketing-location="public_header"
        data-marketing-label="register"
        data-marketing-destination="/register"
      >
        <ArrowRight className="size-5 shrink-0" variant="Bold" />
        <span className="hidden min-[390px]:inline">Register</span>
      </Link>
    </div>
  );
}
