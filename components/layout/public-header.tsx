"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, Store, UserPlus, X } from "lucide-react";
import { company } from "@/lib/constants";
import { sessionHomePath } from "@/lib/session-routing";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PublicAuthActions } from "./public-auth-actions";

type PublicHeaderLink = {
  href: string;
  label: string;
};

type SessionResponse = {
  user?: unknown;
};

const defaultLinks: PublicHeaderLink[] = [
  { href: "/features", label: "Features" },
  { href: "/technology-innovation", label: "Technology" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" }
];

export function PublicHeader({
  session,
  links = defaultLinks,
  demoHref = "/b/sri-sai-tiffins",
  demoLabel = "Demo Store"
}: {
  session?: SessionUser | null;
  links?: PublicHeaderLink[];
  demoHref?: string;
  demoLabel?: string;
}) {
  const [clientSession, setClientSession] = useState<SessionUser | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const resolvedSession = session === undefined ? clientSession : session;
  const isAdmin = resolvedSession?.role === "SUPER_ADMIN";
  const isSupportAgent = resolvedSession?.role === "SUPPORT_AGENT";
  const isCustomer = resolvedSession?.role === "CUSTOMER";
  const workspaceHref = resolvedSession ? sessionHomePath(resolvedSession) : "/dashboard";
  const workspaceLabel = isAdmin ? "Admin Panel" : isSupportAgent ? "VyapaarMate Support" : isCustomer ? "User Portal" : "Dashboard";
  const demoRel = demoHref.startsWith("/b/") ? "nofollow" : undefined;

  useEffect(() => {
    if (session !== undefined) return;

    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin"
        });
        const payload = (await response.json()) as SessionResponse;
        if (!cancelled) setClientSession(readSessionUser(payload.user));
      } catch {
        if (!cancelled) setClientSession(null);
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const updateScrolledState = () => {
      setIsScrolled(window.scrollY > 12);
    };

    updateScrolledState();
    window.addEventListener("scroll", updateScrolledState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolledState);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeMobileMenu() {
      setMobileMenuOpen(false);
      window.requestAnimationFrame(() => mobileButtonRef.current?.focus());
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (mobilePanelRef.current?.contains(target) || mobileButtonRef.current?.contains(target)) return;
      closeMobileMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileMenu();
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
      if (window.innerWidth >= 1280) setMobileMenuOpen(false);
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
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="h-16">
      <nav
        className={cn(
          "fixed inset-x-0 top-0 z-40 w-full border-b px-3 backdrop-blur transition-colors duration-300 sm:px-6 lg:px-8",
          isScrolled ? "border-white/10 bg-black/95 shadow-[0_18px_55px_rgba(0,0,0,0.28)]" : "border-line bg-white/95"
        )}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            href="/"
            className={cn("flex min-w-0 items-center gap-2 justify-self-start font-bold transition-colors", isScrolled ? "text-white" : "text-ink")}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                isScrolled ? "bg-emerald text-white" : "bg-ink text-white"
              )}
            >
              VM
            </span>
            <span className="hidden sm:inline">{company.product}</span>
          </Link>
          {!isCustomer && (
            <div
              className={cn(
                "hidden min-w-0 items-center justify-center gap-4 text-[13px] font-semibold transition-colors xl:flex 2xl:gap-6 2xl:text-sm",
                isScrolled ? "text-white/75" : "text-slate-600"
              )}
            >
              {links.map((link) => (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  className={cn("transition", isScrolled ? "hover:text-white" : "hover:text-ink")}
                  data-marketing-event="navigation_click"
                  data-marketing-location="public_header"
                  data-marketing-label={link.label}
                  data-marketing-destination={link.href}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={demoHref}
                rel={demoRel}
                className="transition hover:text-emerald"
                data-marketing-event="navigation_click"
                data-marketing-location="public_header"
                data-marketing-label={demoLabel}
                data-marketing-destination={demoHref}
              >
                {demoLabel}
              </Link>
            </div>
          )}
          <div className="flex shrink-0 items-center justify-self-end gap-2">
            {!isCustomer && (
              <button
                ref={mobileButtonRef}
                type="button"
                aria-label={mobileMenuOpen ? "Close site navigation" : "Open site navigation"}
                aria-expanded={mobileMenuOpen}
                aria-controls="public-mobile-navigation"
                aria-haspopup="dialog"
                onClick={() => setMobileMenuOpen((value) => !value)}
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-lg border transition duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-4 xl:hidden",
                  isScrolled
                    ? "border-white/15 bg-white/10 text-white shadow-[0_16px_40px_rgba(0,0,0,0.24)] hover:border-white/35 focus:ring-white/15"
                    : "border-line bg-white text-ink shadow-sm hover:border-emerald/40 hover:text-emerald focus:ring-emerald/15"
                )}
              >
                <Menu
                  className={cn(
                    "absolute size-5 transition-all duration-300",
                    mobileMenuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
                  )}
                />
                <X
                  className={cn(
                    "absolute size-5 transition-all duration-300",
                    mobileMenuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
                  )}
                />
              </button>
            )}
            <PublicAuthActions
              isAuthenticated={Boolean(resolvedSession)}
              isAdmin={isAdmin}
              isCustomer={isCustomer}
              workspaceHref={workspaceHref}
              workspaceLabel={workspaceLabel}
              isHeaderScrolled={isScrolled}
            />
          </div>
        </div>
        {!isCustomer && mobileMenuOpen && (
          <div className="fixed inset-x-0 bottom-0 top-16 z-50 xl:hidden">
            <button
              type="button"
              aria-label="Close site navigation"
              className="absolute inset-0 bg-ink/45 backdrop-blur-sm motion-safe:animate-[public-mobile-backdrop-in_180ms_ease-out]"
              onClick={closeMobileMenu}
            />
            <div
              ref={mobilePanelRef}
              id="public-mobile-navigation"
              role="dialog"
              aria-modal="true"
              className="safe-bottom relative mx-3 mt-3 max-h-[calc(100svh-5.5rem)] overflow-y-auto rounded-lg border border-white/75 bg-white shadow-[0_28px_90px_rgba(13,19,33,0.24)] motion-safe:animate-[public-mobile-panel-in_260ms_cubic-bezier(0.22,1,0.36,1)] sm:ml-auto sm:mr-6 sm:max-w-sm"
            >
              <div className="grid gap-2 px-3 py-3">
                {links.map((link, index) => (
                  <Link
                    key={`${link.href}-${link.label}-mobile`}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className="flex h-12 items-center justify-between gap-3 rounded-lg px-3 text-sm font-bold text-slate-700 transition hover:bg-mist hover:text-ink focus:outline-none focus:ring-4 focus:ring-ocean/10 motion-safe:animate-[public-mobile-item-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{ animationDelay: `${70 + index * 45}ms` }}
                    data-marketing-event="navigation_click"
                    data-marketing-location="public_mobile_menu"
                    data-marketing-label={link.label}
                    data-marketing-destination={link.href}
                  >
                    <span className="min-w-0 truncate">{link.label}</span>
                    <ArrowUpRight className="size-4 shrink-0 text-slate-400" />
                  </Link>
                ))}
                <Link
                  href={demoHref}
                  rel={demoRel}
                  onClick={closeMobileMenu}
                  className="flex h-12 items-center justify-between gap-3 rounded-lg px-3 text-sm font-bold text-slate-700 transition hover:bg-emerald/10 hover:text-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15 motion-safe:animate-[public-mobile-item-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]"
                  style={{ animationDelay: `${70 + links.length * 45}ms` }}
                  data-marketing-event="navigation_click"
                  data-marketing-location="public_mobile_menu"
                  data-marketing-label={demoLabel}
                  data-marketing-destination={demoHref}
                >
                  <span className="min-w-0 truncate">{demoLabel}</span>
                  <Store className="size-4 shrink-0 text-emerald" />
                </Link>
              </div>

              <div className="grid gap-2 border-t border-line bg-mist/70 px-3 py-3">
                {resolvedSession ? (
                  <Link
                    href={workspaceHref}
                    onClick={closeMobileMenu}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-emerald focus:outline-none focus:ring-4 focus:ring-emerald/20"
                    data-marketing-event="navigation_click"
                    data-marketing-location="public_mobile_menu"
                    data-marketing-label={workspaceLabel}
                    data-marketing-destination={workspaceHref}
                  >
                    <ArrowUpRight className="size-4" />
                    <span>{workspaceLabel}</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/register"
                      onClick={closeMobileMenu}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-emerald focus:outline-none focus:ring-4 focus:ring-emerald/20"
                      data-marketing-event="cta_click"
                      data-marketing-location="public_mobile_menu"
                      data-marketing-label="register"
                      data-marketing-destination="/register"
                    >
                      <UserPlus className="size-4" />
                      <span>Register</span>
                    </Link>
                    <Link
                      href="/login?type=user&next=%2Fbusinesses"
                      onClick={closeMobileMenu}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-emerald/40 hover:text-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15"
                      data-marketing-event="cta_click"
                      data-marketing-location="public_mobile_menu"
                      data-marketing-label="view_more"
                      data-marketing-destination="/login?type=user&next=%2Fbusinesses"
                    >
                      <span>View More</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

function readSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<SessionUser>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.role !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    role: candidate.role,
    businessId: typeof candidate.businessId === "string" ? candidate.businessId : null
  };
}
