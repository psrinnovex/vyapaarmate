"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, Store, UserPlus, X } from "lucide-react";
import { company } from "@/lib/constants";
import { sessionHomePath } from "@/lib/session-routing";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PublicAuthActions } from "./public-auth-actions";
import { BrandMark } from "@/components/ui/brand-mark";

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
  { href: "/pricing", label: "Launch Pricing" },
  { href: "/contact", label: "Contact" }
];

export function PublicHeader({
  session,
  links = defaultLinks,
  demoHref = "/demo",
  demoLabel = "Live demo"
}: {
  session?: SessionUser | null;
  links?: PublicHeaderLink[];
  demoHref?: string;
  demoLabel?: string;
}) {
  const [clientSession, setClientSession] = useState<SessionUser | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
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

  // Smart header: condenses after a few pixels, slides away while scrolling down and
  // comes back on the first scroll up. One rAF per frame, state only changes on flips.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      setIsScrolled(y > 12);
      if (Math.abs(delta) > 6) {
        setIsHidden(delta > 0 && y > 160);
        lastY = y;
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
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

  const hidden = isHidden && !mobileMenuOpen;

  return (
    <div className="h-[4.75rem]">
      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-x-0 top-0 z-40 px-3 pt-3 transition-transform duration-300 ease-out motion-reduce:transition-none sm:px-5",
          // No transform while visible: a transformed parent would trap the fixed mobile menu.
          hidden && "-translate-y-[130%]"
        )}
      >
        <div
          className={cn(
            "glass mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.4rem] px-2.5 transition-[height,box-shadow,background-color] duration-300 sm:px-3",
            isScrolled ? "h-14 shadow-[0_22px_50px_-24px_rgba(60,40,10,0.45)]" : "h-16"
          )}
        >
          <Link href="/" aria-label="VyapaarMate home" className="flex min-w-0 items-center gap-2 justify-self-start rounded-xl pr-2 font-extrabold tracking-[-0.02em] text-ink">
            <BrandMark surface="light" className={cn("transition-all duration-300", isScrolled ? "size-9" : "size-10")} />
            <span className="hidden sm:inline">{company.product}</span>
          </Link>
          {!isCustomer && (
            <div className="hidden min-w-0 items-center justify-center gap-0.5 text-[13px] font-bold text-ink-600 xl:flex 2xl:text-sm">
              {links.map((link) => (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  className="rounded-full px-3 py-2 transition hover:bg-white hover:text-ink hover:shadow-clay-sm"
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
                className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-2 text-green-700 transition hover:bg-brand hover:text-white"
                data-marketing-event="navigation_click"
                data-marketing-location="public_header"
                data-marketing-label={demoLabel}
                data-marketing-destination={demoHref}
              >
                <span className="size-1.5 rounded-full bg-current" />
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
                className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-white bg-white text-ink shadow-clay-sm transition duration-300 hover:text-brand-text focus:outline-none focus:ring-4 focus:ring-brand/15 xl:hidden"
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
          <div className="fixed inset-x-0 bottom-0 top-0 z-[-1] xl:hidden">
            <button
              type="button"
              aria-label="Close site navigation"
              className="absolute inset-0 bg-ink/35 backdrop-blur-sm motion-safe:animate-[public-mobile-backdrop-in_180ms_ease-out]"
              onClick={closeMobileMenu}
            />
            <div
              ref={mobilePanelRef}
              id="public-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              className="safe-bottom relative mx-3 mt-[5.25rem] max-h-[calc(100svh-6.5rem)] overflow-y-auto rounded-[1.75rem] border border-white bg-white/95 shadow-clay-lg backdrop-blur-xl motion-safe:animate-[public-mobile-panel-in_260ms_cubic-bezier(0.22,1,0.36,1)] sm:ml-auto sm:mr-5 sm:max-w-sm"
            >
              <div className="grid gap-1.5 px-3 py-3">
                {links.map((link, index) => (
                  <Link
                    key={`${link.href}-${link.label}-mobile`}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className="flex h-12 items-center justify-between gap-3 rounded-2xl px-3.5 text-[15px] font-extrabold text-ink-700 transition hover:bg-ivory-100 hover:text-ink focus:outline-none focus:ring-4 focus:ring-green-700/10 motion-safe:animate-[public-mobile-item-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{ animationDelay: `${70 + index * 45}ms` }}
                    data-marketing-event="navigation_click"
                    data-marketing-location="public_mobile_menu"
                    data-marketing-label={link.label}
                    data-marketing-destination={link.href}
                  >
                    <span className="min-w-0 truncate">{link.label}</span>
                    <ArrowUpRight className="size-4 shrink-0 text-ink-500" />
                  </Link>
                ))}
                <Link
                  href={demoHref}
                  rel={demoRel}
                  onClick={closeMobileMenu}
                  className="flex h-12 items-center justify-between gap-3 rounded-2xl bg-green-50 px-3.5 text-[15px] font-extrabold text-green-700 transition hover:bg-brand hover:text-white focus:outline-none focus:ring-4 focus:ring-brand/15 motion-safe:animate-[public-mobile-item-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]"
                  style={{ animationDelay: `${70 + links.length * 45}ms` }}
                  data-marketing-event="navigation_click"
                  data-marketing-location="public_mobile_menu"
                  data-marketing-label={demoLabel}
                  data-marketing-destination={demoHref}
                >
                  <span className="min-w-0 truncate">{demoLabel}</span>
                  <Store className="size-4 shrink-0" />
                </Link>
              </div>

              <div className="grid gap-2 border-t border-ink-200 bg-ivory-100/60 px-3 py-3">
                {resolvedSession ? (
                  <Link
                    href={workspaceHref}
                    onClick={closeMobileMenu}
                    className="clay-press inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-clay-ink px-4 text-sm font-extrabold text-white [--clay-shadow:rgba(0,0,0,0.6)] theme-dark"
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
                      href="/register?plan=STARTER"
                      onClick={closeMobileMenu}
                      className="clay-press inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-clay-green px-4 text-sm font-extrabold text-ink [--clay-shadow:rgba(11,122,16,0.6)]"
                      data-marketing-event="cta_click"
                      data-marketing-location="public_mobile_menu"
                      data-marketing-label="join_bengaluru_launch"
                      data-marketing-destination="/register?plan=STARTER"
                    >
                      <UserPlus className="size-4" />
                      <span>Register your shop</span>
                    </Link>
                    <Link
                      href="/login?type=user&next=%2Fbusinesses"
                      onClick={closeMobileMenu}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white bg-white px-4 text-sm font-extrabold text-ink shadow-clay-sm transition hover:text-brand-text focus:outline-none focus:ring-4 focus:ring-brand/15"
                      data-marketing-event="cta_click"
                      data-marketing-location="public_mobile_menu"
                      data-marketing-label="view_more"
                      data-marketing-destination="/login?type=user&next=%2Fbusinesses"
                    >
                      <span>Browse shops</span>
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
