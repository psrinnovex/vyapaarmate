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
              "grid size-10 shrink-0 place-items-center rounded-xl border border-white bg-white text-ink shadow-clay-sm transition hover:text-emerald",
              isHeaderScrolled && "shadow-none"
            )}
          >
            <Menu className="size-5" />
          </button>
          {menuOpen && (
            <div
              id="user-portal-menu"
              className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-clay-lg"
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
                        "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition",
                        active ? "bg-clay-ink text-white shadow-clay-sm" : "text-slate-700 hover:bg-mist hover:text-ink"
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
                  className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-berry-deep transition hover:bg-berry-soft disabled:cursor-not-allowed disabled:opacity-60"
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
            "clay-press inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-clay-ink px-3.5 text-sm font-extrabold text-white [--clay-shadow:rgba(13,10,34,0.6)]",
            isHeaderScrolled && "h-9"
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
            "grid size-10 shrink-0 place-items-center rounded-xl border border-white bg-white text-slate-600 shadow-clay-sm transition hover:text-berry-deep disabled:cursor-not-allowed disabled:opacity-60",
            isHeaderScrolled && "size-9"
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
          "hidden h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-extrabold text-slate-600 transition hover:bg-white hover:text-ink sm:inline-flex",
          isHeaderScrolled && "h-9"
        )}
        data-marketing-event="cta_click"
        data-marketing-location="public_header"
        data-marketing-label="view_more"
        data-marketing-destination="/login?type=user&next=%2Fbusinesses"
      >
        <span className="hidden sm:inline">Browse shops</span>
      </Link>
      <Link
        href="/register?plan=STARTER"
        aria-label="Register"
        title="Register"
        className={cn(
          "clay-press hidden h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-clay-emerald px-3.5 text-sm font-extrabold text-white [--clay-shadow:rgba(8,128,74,0.6)] sm:inline-flex",
          isHeaderScrolled && "h-9"
        )}
        data-marketing-event="cta_click"
        data-marketing-location="public_header"
        data-marketing-label="register"
        data-marketing-destination="/register?plan=STARTER"
      >
        <ArrowRight className="size-5 shrink-0" variant="Bold" />
        <span className="hidden min-[390px]:inline">Register</span>
      </Link>
    </div>
  );
}
