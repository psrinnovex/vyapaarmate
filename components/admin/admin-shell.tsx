"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { adminNav, company } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LogOut, Menu, ShieldCheck, X } from "lucide-react";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/support") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, role }: { children: React.ReactNode; role: Role }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const supportOnly = role === "SUPPORT_AGENT";
  const supportNavItem = adminNav.find((item) => item.href === "/admin/support");
  const visibleNav = supportOnly && supportNavItem ? [{ ...supportNavItem, href: "/support" }] : adminNav;
  const shellHomeHref = supportOnly ? "/support" : "/admin";
  const shellTitle = supportOnly ? "VyapaarMate Support" : "PSHR Admin";
  const headerTitle = supportOnly ? "VyapaarMate Support" : "PSHR Innovex Admin Panel";
  const footerTitle = supportOnly ? "VyapaarMate Support" : company.name;

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

  const closeMobileNav = () => setMobileNavOpen(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div className="fixed inset-0 min-h-0 w-full max-w-full overflow-hidden theme-dark bg-[radial-gradient(64rem_36rem_at_6%_-12%,rgba(30,201,38,0.18),transparent_60%),radial-gradient(52rem_34rem_at_100%_0%,rgba(242,162,12,0.12),transparent_60%),linear-gradient(180deg,#121512_0%,#0b0d0b_100%)] text-white lg:grid lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)]">
      <aside className="hidden h-full min-h-0 min-w-0 overflow-hidden p-3 pr-0 lg:block">
        <div className="glass-dark flex h-full min-h-0 min-w-0 flex-col rounded-[1.75rem] p-3">
          <Link href={shellHomeHref} className="flex min-w-0 shrink-0 items-center gap-3 rounded-[1.25rem] bg-white p-3 font-extrabold text-ink shadow-clay-sm">
            <BrandMark />
            <span className="min-w-0 truncate text-base">{shellTitle}</span>
          </Link>
          <div className="mt-3 shrink-0 rounded-2xl border border-brand/25 bg-brand/10 p-3 text-xs font-semibold leading-5 text-green-100">
            {supportOnly ? "Support queue access only. Customer and payment details stay scoped to tickets." : "Super admin access only. All business-level data remains tenant scoped."}
          </div>
          <nav className="scrollbar-none mt-4 grid min-h-0 flex-1 auto-rows-max gap-1 overflow-y-auto">
            {visibleNav.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-11 min-w-0 items-center gap-3 rounded-2xl px-2 text-sm font-bold transition",
                    active ? "bg-white text-ink shadow-clay-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl transition", active ? "bg-clay-green text-ink" : "bg-white/10 text-white/70 group-hover:text-white")}>
                    <item.icon className="size-4 shrink-0" />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 shrink-0 rounded-[1.25rem] bg-white/10 p-3">
            <p className="truncate text-sm font-bold">{footerTitle}</p>
            <p className="mt-1 text-xs text-white/50">{supportOnly ? "Support operations" : "Platform operations"}</p>
          </div>
        </div>
      </aside>
      <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
        <header className="glass-dark z-30 mx-3 mt-3 flex h-16 min-w-0 shrink-0 items-center justify-between gap-3 rounded-[1.4rem] px-3 py-3 lg:mx-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={mobileButtonRef}
              type="button"
              aria-label={mobileNavOpen ? "Close admin navigation" : "Open admin navigation"}
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-navigation"
              onClick={() => setMobileNavOpen((value) => !value)}
              className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-white transition duration-300 hover:-translate-y-0.5 hover:text-green-300 focus:outline-none focus:ring-4 focus:ring-brand/15 lg:hidden"
            >
              <Menu
                className={cn(
                  "absolute size-5 transition-all duration-300",
                  mobileNavOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
                )}
              />
              <X
                className={cn(
                  "absolute size-5 transition-all duration-300",
                  mobileNavOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
                )}
              />
            </button>
            <div className="clay-orb hidden size-10 shrink-0 rounded-xl bg-clay-green text-ink sm:grid">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-5 text-white">{headerTitle}</p>
              <p className="truncate text-xs leading-5 text-white/55">{supportOnly ? "Support queue and customer follow-up" : "Platform analytics, business verification, billing, logs"}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            disabled={loggingOut}
            onClick={logout}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition hover:text-kumkum-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close admin navigation"
              className="absolute inset-0 bg-ink-950/72 backdrop-blur-md motion-safe:animate-[admin-mobile-backdrop-in_180ms_ease-out]"
              onClick={closeMobileNav}
            />
            <div
              ref={mobilePanelRef}
              id="admin-mobile-navigation"
              className="admin-mobile-drawer safe-bottom relative flex h-full max-h-[100svh] w-[min(88vw,22.5rem)] flex-col overflow-hidden border-r border-white/10 p-3 text-white shadow-[34px_0_90px_rgba(0,0,0,0.42)] motion-safe:animate-[admin-mobile-drawer-in_340ms_cubic-bezier(0.22,1,0.36,1)]"
            >
              <div className="relative z-10 flex shrink-0 items-center justify-between gap-3">
                <Link href={shellHomeHref} onClick={closeMobileNav} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-white p-3 font-bold text-ink transition hover:-translate-y-0.5">
                  <BrandMark />
                  <span className="min-w-0 truncate text-base">{shellTitle}</span>
                </Link>
                <button
                  type="button"
                  aria-label="Close admin navigation"
                  onClick={closeMobileNav}
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition hover:border-brand/40 hover:text-brand-text focus:outline-none focus:ring-4 focus:ring-brand/15"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="relative z-10 mt-4 shrink-0 rounded-lg border border-brand/25 bg-brand/10 p-3 text-xs leading-5 text-green-50 shadow-[0_18px_48px_rgba(30,201,38,0.08)]">
                {supportOnly ? "Support queue access only. Customer and payment details stay scoped to tickets." : "Super admin access only. All business-level data remains tenant scoped."}
              </div>
              <nav className="relative z-10 mt-5 grid min-h-0 flex-1 auto-rows-max gap-1 overflow-y-auto pr-1">
                {visibleNav.map((item, index) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={`${item.href}-mobile`}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={closeMobileNav}
                      className={cn(
                        "flex h-12 min-w-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-4 focus:ring-brand/15 motion-safe:animate-[admin-mobile-item-in_360ms_cubic-bezier(0.22,1,0.36,1)_both]",
                        active
                          ? "bg-white text-ink shadow-[0_18px_42px_rgba(255,255,255,0.12)]"
                          : "text-white/72 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                      )}
                      style={{ animationDelay: `${80 + index * 38}ms` }}
                    >
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", active ? "bg-brand/15 text-brand-text" : "bg-white/5 text-white/70")}>
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="relative z-10 mt-5 grid shrink-0 gap-3 rounded-lg border border-white/10 bg-white/10 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{footerTitle}</p>
                  <p className="mt-1 text-xs text-white/50">{supportOnly ? "Support operations" : "Platform operations"}</p>
                </div>
                <button
                  type="button"
                  aria-label="Log out"
                  disabled={loggingOut}
                  onClick={logout}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-ink-950/40 px-3 text-sm font-bold text-white/80 transition hover:border-kumkum-300/40 hover:text-kumkum-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="size-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain text-ink">
          <div className="mx-auto min-w-0 max-w-[1680px] overflow-x-hidden px-4 py-5 sm:px-5 lg:px-6 lg:py-6 xl:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
