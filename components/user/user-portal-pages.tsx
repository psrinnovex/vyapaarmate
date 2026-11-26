"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarCheck2, Clock3, Download, Home, Mail, MapPin, Phone, ReceiptText, Settings, ShieldCheck, Store, Trash2, UserRound, WalletCards } from "lucide-react";
import { ClayIllustration, illustrationNameForBusinessType, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { useRouteRefreshOnStream } from "@/hooks/use-live-sync";
import {
  CUSTOMER_ACCOUNT_DELETE_CONFIRMATION,
  CUSTOMER_ACCOUNT_RETENTION_NOTICE
} from "@/lib/customer-account-copy";
import type { getCustomerPortalBusinessProfiles, getCustomerPortalOrders, getCustomerPortalUser } from "@/lib/user-portal";
import { fulfillmentLabelForBusinessType, type ActiveFulfillmentMode } from "@/lib/business-rules";
import { cn, formatINR, initials } from "@/lib/utils";
import { getOrderTrackingStatusLabel } from "@/lib/order-tracking";
import { Button, ButtonLink } from "@/components/ui/button";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sticker } from "@/components/ui/sticker";
import { PasswordInput } from "@/components/ui/form-fields";
import { Input, Label } from "@/components/ui/input";
import { PaginationControls, usePaginatedItems } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { OrderStatusAnimation } from "@/components/ui/order-status-animation";
import { PaymentStatusAnimation } from "@/components/ui/payment-status-animation";

type PortalUser = Awaited<ReturnType<typeof getCustomerPortalUser>>;
type PortalOrder = Awaited<ReturnType<typeof getCustomerPortalOrders>>[number];
type PortalBusinessProfile = Awaited<ReturnType<typeof getCustomerPortalBusinessProfiles>>[number];

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium"
});

function normalizedDate(value: Date | string | null) {
  if (!value) return "Not available";
  return value instanceof Date ? value : new Date(value);
}

function formatDate(value: Date | string | null) {
  const date = normalizedDate(value);
  if (date === "Not available") return date;
  return dateFormatter.format(date);
}

function formatShortDate(value: Date | string | null) {
  const date = normalizedDate(value);
  if (date === "Not available") return date;
  return shortDateFormatter.format(date);
}

function formatScheduledAppointment(order: PortalOrder) {
  if (!order.appointment) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: order.appointment.timezone,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(normalizedDate(order.appointment.startsAt) as Date);
}

function orderItemsSummary(order: PortalOrder) {
  if (order.items.length === 0) return "No items";
  const firstItems = order.items.slice(0, 2).map((item) => `${item.quantity} x ${item.itemName}`);
  const hiddenCount = order.items.length - firstItems.length;
  return hiddenCount > 0 ? `${firstItems.join(", ")} + ${hiddenCount} more` : firstItems.join(", ");
}

function orderTypeLabel(order: PortalOrder) {
  if (order.orderType === "DELIVERY") return "Delivery";
  return fulfillmentLabelForBusinessType(order.business.businessType, order.orderType as ActiveFulfillmentMode);
}

async function readAccountActionError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const portalTabs = [
  { href: "/user", label: "Browse", icon: Store },
  { href: "/user/bookings", label: "Bookings", icon: CalendarCheck2 },
  { href: "/user/profile", label: "Profile", icon: UserRound },
  { href: "/user/settings", label: "Settings", icon: Settings }
] as const;

/** App-style segmented navigation shared by every user portal screen. */
export function UserPortalTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="User portal" className={cn("glass mx-auto flex w-full max-w-xl gap-1 rounded-[1.4rem] p-1.5", className)}>
      {portalTabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-xs font-extrabold transition sm:gap-2 sm:text-sm",
              active ? "bg-clay-ink text-white shadow-clay-sm theme-dark" : "text-ink-500 hover:bg-white hover:text-ink"
            )}
          >
            <tab.icon className="size-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PortalPageShell({
  eyebrow,
  title,
  body,
  action,
  illustration,
  children
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  illustration: ClayIllustrationName;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-x-clip text-ink">
      <section className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl min-w-0">
          <UserPortalTabs />
          <div className="relative mt-4 overflow-hidden rounded-[2.25rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95)_0%,rgba(243,238,226,0.9)_55%,rgba(212,238,239,0.85)_100%)] p-5 shadow-clay sm:p-8">
            <div aria-hidden="true" className="vm-blob -right-12 -top-16 size-64 bg-marigold-400 opacity-35" />
            <div className="relative grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <Sticker tone="peacock" tilt={-3}>{eyebrow}</Sticker>
                <h1 className="mt-3 break-words text-[clamp(1.8rem,4.2vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-ink-600 sm:text-base">{body}</p>
                {action && <div className="mt-5">{action}</div>}
              </div>
              <div aria-hidden="true" className="hidden w-32 sm:block lg:w-40">
                <ClayIllustration name={illustration} className="motion-safe:animate-float-slow" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl min-w-0">{children}</div>
      </section>
    </main>
  );
}

const statTones = {
  ink: "bg-clay-ink text-brand theme-dark",
  green: "bg-clay-green text-ink",
  peacock: "bg-clay-peacock text-white",
  marigold: "bg-clay-marigold text-ink"
} as const;

type StatTone = keyof typeof statTones;

function PortalStat({
  icon,
  label,
  value,
  detail,
  tone = "ink",
  delay = 0
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: StatTone;
  delay?: number;
}) {
  return (
    <ScrollReveal delay={delay} className="h-full min-w-0">
      <div className="clay flex h-full min-w-0 items-start gap-4 rounded-[1.75rem] p-5">
        <span className={cn("clay-orb size-12 shrink-0 rounded-2xl", statTones[tone])}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold leading-tight tracking-[-0.03em] [overflow-wrap:anywhere]">{value}</p>
          <p className="mt-1 text-xs font-semibold text-ink-500">{detail}</p>
        </div>
      </div>
    </ScrollReveal>
  );
}

function LatestBookingPanel({ order }: { order?: PortalOrder }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/15 sm:flex-row sm:items-center">
      <span className="clay-orb size-11 shrink-0 rounded-2xl bg-white/15 text-white">
        <Clock3 className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/55">Recent activity</p>
        <p className="mt-1 truncate text-sm font-bold text-white">{order ? `${order.orderNumber} with ${order.business.name}` : "No bookings recorded yet"}</p>
        <p className="mt-0.5 text-xs font-semibold text-white/60">
          {order ? formatScheduledAppointment(order) ?? formatDate(order.createdAt) : "New bookings will appear here."}
        </p>
      </div>
      {order && (
        <ButtonLink href={`/order/${order.publicToken}`} variant="secondary" size="sm" icon={<ArrowUpRight className="size-3.5" />} iconPosition="end">
          View booking
        </ButtonLink>
      )}
    </div>
  );
}

/** A torn-ticket card: details on the left, the amount and live status on the stub. */
function BookingTicket({ order, index }: { order: PortalOrder; index: number }) {
  const statusLabel = getOrderTrackingStatusLabel(order.business.businessType, order.orderType, order.status);
  const art = illustrationNameForBusinessType(order.business.businessType);

  return (
    <ScrollReveal delay={Math.min(index, 6) * 40}>
      <article className="clay relative grid min-w-0 overflow-hidden rounded-[2rem] md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 gap-4 p-5 sm:p-6">
          <span className="size-16 shrink-0 rounded-2xl bg-ivory-100 p-1.5 shadow-clay-inset">
            <ClayIllustration name={art} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-clay-ink px-2.5 py-0.5 text-xs font-extrabold text-white theme-dark">{order.orderNumber}</span>
              <span className="text-xs font-bold text-ink-500">{formatDate(order.createdAt)}</span>
            </div>
            <Link href={`/b/${order.business.slug}`} className="mt-2 block truncate text-lg font-extrabold tracking-[-0.02em] text-ink transition hover:text-brand-text">
              {order.business.name}
            </Link>
            <p className="flex items-center gap-1 text-xs font-semibold text-ink-500">
              <MapPin className="size-3.5" />
              {[order.business.city, order.business.state].filter(Boolean).join(", ") || "Local area"}
            </p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">{orderItemsSummary(order)}</p>
            {order.notes && <p className="mt-1 line-clamp-1 text-xs text-ink-500">Note: {order.notes}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              {orderTypeLabel(order) && <span className="rounded-full bg-ivory-100 px-2.5 py-1 text-ink-600">{orderTypeLabel(order)}</span>}
              {order.appointment ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-peacock-600/10 px-2.5 py-1 text-peacock-700">
                  <CalendarCheck2 className="size-3.5" />
                  {formatScheduledAppointment(order)} · {order.appointment.provider.name} · {order.appointment.status.toLowerCase().replace("_", " ")}
                </span>
              ) : (
                <span className="rounded-full bg-ivory-100 px-2.5 py-1 text-ink-500">No reserved time</span>
              )}
            </div>
          </div>
        </div>

        <div className="relative border-t-2 border-dashed border-ink-200 md:border-l-2 md:border-t-0">
          <span aria-hidden="true" className="absolute -left-3 -top-3 size-6 rounded-full bg-ivory-100 shadow-clay-inset md:-left-3 md:-top-3" />
          <span aria-hidden="true" className="absolute -right-3 -top-3 size-6 rounded-full bg-ivory-100 shadow-clay-inset md:-bottom-3 md:-left-3 md:right-auto md:top-auto" />
          <div className="flex h-full flex-col gap-3 p-5 sm:p-6">
            <p className="text-3xl font-extrabold tracking-[-0.04em]">{formatINR(order.totalAmount)}</p>
            <div className="flex items-center gap-2">
              <OrderStatusAnimation status={order.status} businessType={order.business.businessType} orderType={order.orderType} label={statusLabel} className="size-8" />
              <StatusPill status={order.status} label={statusLabel} />
            </div>
            <div className="flex items-center gap-2">
              <PaymentStatusAnimation status={order.paymentStatus} provider={order.payment?.provider ?? "CASH"} label={`${order.paymentStatus.toLowerCase()} payment`} />
              <StatusPill status={order.paymentStatus} />
              <span className="text-xs font-bold text-ink-500">{order.payment?.provider ?? "CASH"}</span>
            </div>
            <ButtonLink href={`/order/${order.publicToken}`} variant="dark" className="mt-auto w-full" icon={<ArrowUpRight className="size-4" />} iconPosition="end">
              View
            </ButtonLink>
          </div>
        </div>
      </article>
    </ScrollReveal>
  );
}

export function UserBookingsPage({ user, orders }: { user: PortalUser; orders: PortalOrder[] }) {
  useRouteRefreshOnStream("/api/user/live?scope=bookings", "user");

  const activeBookings = orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status)).length;
  const pendingPayments = orders.filter((order) => order.paymentStatus === "PENDING").length;
  const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const orderPagination = usePaginatedItems(orders, {
    resetKey: `${orders.length}-${orders[0]?.id ?? "empty"}-${orders.at(-1)?.id ?? "empty"}`
  });

  return (
    <PortalPageShell
      eyebrow="Bookings"
      title="Your bookings"
      body={`Track every order, service request, and booking connected to ${user.email}.`}
      illustration="bag"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat icon={<CalendarCheck2 className="size-5" />} label="Total bookings" value={String(orders.length)} detail="Latest 100 records" tone="ink" />
        <PortalStat icon={<ReceiptText className="size-5" />} label="Active" value={String(activeBookings)} detail="Open status updates" tone="peacock" delay={60} />
        <PortalStat icon={<WalletCards className="size-5" />} label="Pending payments" value={String(pendingPayments)} detail="Awaiting payment confirmation" tone="marigold" delay={120} />
        <PortalStat icon={<WalletCards className="size-5" />} label="Total value" value={formatINR(totalSpent)} detail="Across matched bookings" tone="green" delay={180} />
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Booking history</h2>
          <p className="mt-1 text-sm font-medium text-ink-500">Sorted by most recent activity.</p>
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="mt-4 grid gap-4">
          {orderPagination.pageItems.map((order, index) => (
            <BookingTicket key={order.id} order={order} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          illustration="calendar"
          title="No bookings yet"
          body="Bookings made with this account email or phone will appear here."
          action={<ButtonLink href="/user" icon={<Home className="size-4" />}>Browse businesses</ButtonLink>}
        />
      )}
      <PaginationControls
        className="mt-5 rounded-2xl border border-white/80 bg-white shadow-clay-sm"
        page={orderPagination.page}
        pageCount={orderPagination.pageCount}
        totalItems={orderPagination.totalItems}
        startItem={orderPagination.startItem}
        endItem={orderPagination.endItem}
        itemLabel="bookings"
        onPageChange={orderPagination.setPage}
      />
    </PortalPageShell>
  );
}

export function UserProfilePage({
  user,
  businessProfiles,
  orders
}: {
  user: PortalUser;
  businessProfiles: PortalBusinessProfile[];
  orders: PortalOrder[];
}) {
  useRouteRefreshOnStream("/api/user/live?scope=profile", "user");

  const lastBooking = orders[0]?.createdAt ?? null;
  const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const linkedCountLabel = `${businessProfiles.length} linked`;
  const profilePagination = usePaginatedItems(businessProfiles, {
    resetKey: `${businessProfiles.length}-${businessProfiles[0]?.id ?? "empty"}-${businessProfiles.at(-1)?.id ?? "empty"}`
  });

  return (
    <PortalPageShell
      eyebrow="Profile"
      title="Your profile"
      body="Account identity, contact details, and booking activity linked to this user portal."
      illustration="customers"
    >
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <ScrollReveal direction="right" className="min-w-0">
          <div className="relative min-w-0 overflow-hidden rounded-[2.25rem] vm-band p-6 text-white shadow-clay-lg sm:p-7">
            <div aria-hidden="true" className="vm-blob -right-16 -top-20 size-64 bg-brand opacity-30" />
            <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative flex min-w-0 items-center gap-4">
              <div className="clay-orb size-16 shrink-0 rounded-[1.4rem] bg-clay-green text-xl font-extrabold text-ink">{initials(user.name)}</div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-extrabold tracking-[-0.03em]">{user.name}</h2>
                <p className="mt-0.5 text-sm font-semibold text-white/60">VyapaarMate account</p>
              </div>
            </div>
            <div className="relative mt-2 flex justify-end">
              <Sticker tone="marigold" tilt={4}>Customer</Sticker>
            </div>
            <div className="relative mt-4 grid gap-2.5 text-sm">
              <ProfileLine icon={<Mail className="size-4" />} label="Email" value={user.email} />
              <ProfileLine icon={<Phone className="size-4" />} label="Phone" value={user.phone ?? "Not added"} />
              <ProfileLine icon={<ShieldCheck className="size-4" />} label="Member since" value={formatShortDate(user.createdAt)} />
            </div>
            <div className="relative mt-5">
              <LatestBookingPanel order={orders[0]} />
            </div>
          </div>
        </ScrollReveal>

        <div className="grid min-w-0 content-start gap-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <PortalStat icon={<ReceiptText className="size-5" />} label="Bookings" value={String(orders.length)} detail="Matched to this account" tone="ink" />
            <PortalStat icon={<WalletCards className="size-5" />} label="Total value" value={formatINR(totalSpent)} detail="Across booking history" tone="green" delay={60} />
            <PortalStat icon={<CalendarCheck2 className="size-5" />} label="Last booking" value={lastBooking ? formatShortDate(lastBooking) : "None"} detail="Most recent record" tone="peacock" delay={120} />
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Business profiles</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-ink-500">Customer records created when you booked with each business.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-ink-600 shadow-clay-sm">{linkedCountLabel}</span>
          </div>
          {businessProfiles.length > 0 ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {profilePagination.pageItems.map((profile, index) => {
                const bookingLabel = profile.totalOrders === 1 ? "booking" : "bookings";
                return (
                  <ScrollReveal key={profile.id} delay={Math.min(index, 6) * 40} className="h-full min-w-0">
                    <article className="clay flex h-full min-w-0 flex-col rounded-[1.75rem] p-5">
                      <Link href={`/b/${profile.business.slug}`} className="inline-flex max-w-full items-center gap-1 text-base font-extrabold text-ink transition hover:text-brand-text">
                        <span className="min-w-0 truncate">{profile.business.name}</span>
                        <ArrowUpRight className="size-3.5 shrink-0" />
                      </Link>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <span className="rounded-2xl bg-ivory-100/80 px-2 py-2">
                          <span className="block text-lg font-extrabold leading-6">{profile.totalOrders}</span>
                          <span className="text-[11px] font-bold text-ink-500">{bookingLabel}</span>
                        </span>
                        <span className="rounded-2xl bg-ivory-100/80 px-2 py-2">
                          <span className="block truncate text-lg font-extrabold leading-6">{formatINR(profile.totalSpent)}</span>
                          <span className="text-[11px] font-bold text-ink-500">spent</span>
                        </span>
                        <span className="rounded-2xl bg-ivory-100/80 px-2 py-2">
                          <span className="block truncate text-sm font-extrabold leading-6">{formatShortDate(profile.lastOrderAt)}</span>
                          <span className="text-[11px] font-bold text-ink-500">last order</span>
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <FlagChip on={profile.whatsappOptIn} label={profile.whatsappOptIn ? "WhatsApp on" : "WhatsApp off"} />
                        <FlagChip on={profile.marketingOptIn} label={profile.marketingOptIn ? "Offers on" : "Offers off"} />
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          ) : (
            <EmptyState
              illustration="shop"
              title="No business profiles linked"
              body="Profiles appear after your first booking with a business."
              action={<ButtonLink href="/user" icon={<Home className="size-4" />}>Browse businesses</ButtonLink>}
            />
          )}
          <PaginationControls
            className="rounded-2xl border border-white/80 bg-white shadow-clay-sm"
            page={profilePagination.page}
            pageCount={profilePagination.pageCount}
            totalItems={profilePagination.totalItems}
            startItem={profilePagination.startItem}
            endItem={profilePagination.endItem}
            itemLabel="business profiles"
            onPageChange={profilePagination.setPage}
          />
        </div>
      </div>
    </PortalPageShell>
  );
}

function FlagChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold", on ? "bg-green-50 text-green-700" : "bg-ink-100 text-ink-500")}>
      <span className={cn("size-1.5 rounded-full", on ? "bg-brand" : "bg-ink-400")} />
      {label}
    </span>
  );
}

export function UserSettingsPage({
  user,
  businessProfiles
}: {
  user: PortalUser;
  businessProfiles: PortalBusinessProfile[];
}) {
  useRouteRefreshOnStream("/api/user/live?scope=settings", "user");

  const communicationPagination = usePaginatedItems(businessProfiles, {
    resetKey: `${businessProfiles.length}-${businessProfiles[0]?.id ?? "empty"}-${businessProfiles.at(-1)?.id ?? "empty"}`
  });

  return (
    <PortalPageShell
      eyebrow="Settings"
      title="User settings"
      body="Review account access, portal identity, and per-business communication status."
      illustration="shield"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsCard icon={<ShieldCheck className="size-5" />} tone="ink" title="Account access" body="Signed-in customer account.">
          <div className="mt-5 grid gap-2">
            <SettingsLine label="Name" value={user.name} />
            <SettingsLine label="Email" value={user.email} />
            <SettingsLine label="Phone" value={user.phone ?? "Not added"} />
            <SettingsLine label="Role" value="Customer" />
          </div>
        </SettingsCard>

        <SettingsCard icon={<Settings className="size-5" />} tone="peacock" title="Communication status" body="Current booking communication flags.">
          <div className="mt-5 grid gap-3">
            {businessProfiles.length > 0 ? (
              communicationPagination.pageItems.map((profile) => (
                <div key={profile.id} className="rounded-2xl bg-ivory-100/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-extrabold">{profile.business.name}</p>
                    <p className="text-xs font-semibold text-ink-500">{profile.totalOrders} bookings</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <FlagChip on={profile.whatsappOptIn} label={`WhatsApp ${profile.whatsappOptIn ? "enabled" : "disabled"}`} />
                    <FlagChip on={profile.marketingOptIn} label={`Offers ${profile.marketingOptIn ? "enabled" : "disabled"}`} />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-ivory-100/80 p-4 text-sm font-semibold text-ink-600">No communication settings are linked yet.</p>
            )}
          </div>
          <PaginationControls
            className="mt-4 rounded-2xl border border-white/80 bg-white shadow-clay-sm"
            page={communicationPagination.page}
            pageCount={communicationPagination.pageCount}
            totalItems={communicationPagination.totalItems}
            startItem={communicationPagination.startItem}
            endItem={communicationPagination.endItem}
            itemLabel="business profiles"
            onPageChange={communicationPagination.setPage}
          />
        </SettingsCard>

        <PasswordChangeCard
          portal="user"
          title="User password"
          body="Change the password used for user portal sign-in."
        />

        <CustomerAccountDataControls />
      </div>
    </PortalPageShell>
  );
}

function SettingsCard({
  icon,
  tone,
  title,
  body,
  className,
  children
}: {
  icon: React.ReactNode;
  tone: StatTone | "kumkum";
  title: string;
  body: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const orb = tone === "kumkum" ? "bg-clay-kumkum text-white" : statTones[tone];
  return (
    <section className={cn("clay min-w-0 rounded-[2rem] p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        <span className={cn("clay-orb size-12 shrink-0 rounded-2xl", orb)}>{icon}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-ink-500">{body}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function CustomerAccountDataControls() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function downloadData() {
    setExporting(true);
    setExportError("");

    try {
      const response = await fetch("/api/user/data-export", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        setExportError(await readAccountActionError(response, "We could not prepare your data export."));
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "vyapaarmate-customer-data.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("We could not prepare your data export. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== CUSTOMER_ACCOUNT_DELETE_CONFIRMATION || currentPassword.length === 0) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ currentPassword, confirmation })
      });
      if (!response.ok) {
        setDeleteError(await readAccountActionError(response, "We could not delete your account."));
        return;
      }

      window.location.replace("/");
    } catch {
      setDeleteError("We could not delete your account. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <SettingsCard
        className="self-start"
        icon={<Download className="size-5" />}
        tone="ink"
        title="Download your data"
        body="Download a JSON copy of your account profile, linked customer records, bookings, payments, and support requests."
      >
        <Button
          className="mt-5 w-full sm:w-auto"
          type="button"
          variant="secondary"
          icon={<Download className="size-4" />}
          disabled={exporting}
          aria-busy={exporting}
          onClick={downloadData}
        >
          {exporting ? "Preparing download" : "Download my data"}
        </Button>
        {exportError && (
          <p className="mt-3 rounded-2xl bg-kumkum-50 p-3 text-sm leading-6 text-kumkum-700" role="alert">
            {exportError}
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        className="border-2 border-kumkum-600/20 bg-[linear-gradient(180deg,#fdf2ef_0%,#fbe1db_100%)] lg:col-span-2"
        icon={<Trash2 className="size-5" />}
        tone="kumkum"
        title="Delete sign-in account"
        body={<span id="customer-account-retention" className="text-ink-600">{CUSTOMER_ACCOUNT_RETENTION_NOTICE}</span>}
      >
        <form className="mt-5 grid gap-4" onSubmit={deleteAccount}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="delete-account-current-password">Current password</Label>
              <PasswordInput
                id="delete-account-current-password"
                name="currentPassword"
                value={currentPassword}
                autoComplete="current-password"
                showLockIcon
                required
                aria-describedby="customer-account-retention"
                onChange={(event) => setCurrentPassword(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delete-account-confirmation">
                Type <span className="font-extrabold text-kumkum-700">{CUSTOMER_ACCOUNT_DELETE_CONFIRMATION}</span> to confirm
              </Label>
              <Input
                id="delete-account-confirmation"
                name="confirmation"
                value={confirmation}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                aria-describedby="delete-account-confirmation-help customer-account-retention"
                onChange={(event) => setConfirmation(event.currentTarget.value)}
              />
            </div>
          </div>
          <p className="text-xs leading-5 text-ink-500" id="delete-account-confirmation-help">
            This is permanent for the VyapaarMate login and account profile. The retained records described above are not erased.
          </p>

          {deleteError && (
            <p className="rounded-2xl bg-kumkum-50 p-3 text-sm leading-6 text-kumkum-700" role="alert">
              {deleteError}
            </p>
          )}

          <Button
            className="w-full sm:w-auto sm:justify-self-start"
            type="submit"
            variant="danger"
            icon={<Trash2 className="size-4" />}
            disabled={
              deleting ||
              currentPassword.length === 0 ||
              confirmation !== CUSTOMER_ACCOUNT_DELETE_CONFIRMATION
            }
            aria-busy={deleting}
          >
            {deleting ? "Deleting account" : "Permanently delete sign-in account"}
          </Button>
        </form>
      </SettingsCard>
    </>
  );
}

function ProfileLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10">
      <span className="grid size-9 place-items-center rounded-xl bg-white/15 text-green-200">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/50">{label}</p>
        <p className="font-semibold leading-5 text-white [overflow-wrap:anywhere]">{value}</p>
      </div>
    </div>
  );
}

function SettingsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-ivory-100/80 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-500">{label}</p>
      <p className="min-w-0 truncate text-sm font-bold text-ink-700">{value}</p>
    </div>
  );
}
