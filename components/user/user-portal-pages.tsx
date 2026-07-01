"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, CalendarCheck2, Clock3, Home, Mail, MapPin, Phone, ReceiptText, Settings, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { useRouteRefreshOnStream } from "@/hooks/use-live-sync";
import type { getCustomerPortalBusinessProfiles, getCustomerPortalOrders, getCustomerPortalUser } from "@/lib/user-portal";
import { fulfillmentLabelForBusinessType, type ActiveFulfillmentMode } from "@/lib/business-rules";
import { cn, formatINR, initials } from "@/lib/utils";
import { getOrderTrackingStatusLabel } from "@/lib/order-tracking";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PasswordChangeCard } from "@/components/auth/password-change-card";
import { Card } from "@/components/ui/card";
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

function PortalPageShell({
  eyebrow,
  title,
  body,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-mist text-ink">
      <section className="border-b border-line bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Badge variant="blue">{eyebrow}</Badge>
            <h1 className="mt-3 break-words text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{body}</p>
          </div>
          {action}
        </div>
      </section>
      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl min-w-0">{children}</div>
      </section>
    </main>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  detail,
  tone = "ink"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "ink" | "emerald" | "ocean" | "amber";
}) {
  const tones = {
    ink: "bg-ink text-white",
    emerald: "bg-emerald text-white",
    ocean: "bg-ocean text-white",
    amber: "bg-amber-500 text-white"
  };

  return (
    <Card className="grid min-h-32 gap-3 bg-white">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className={cn("grid size-10 place-items-center rounded-lg", tones[tone])}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-extrabold">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
      </div>
    </Card>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
  detail,
  tone = "ink"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "ink" | "emerald" | "ocean" | "amber";
}) {
  const tones = {
    ink: "bg-ink text-white",
    emerald: "bg-emerald text-white",
    ocean: "bg-ocean text-white",
    amber: "bg-amber-500 text-white"
  };

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-line bg-white p-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_2.5rem]">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-xl font-extrabold leading-tight text-ink [overflow-wrap:anywhere] sm:text-2xl sm:leading-tight">{value}</p>
        </div>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg sm:size-10", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function LatestBookingPanel({ order }: { order?: PortalOrder }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-line bg-white px-4 py-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-mist text-ocean">
            <Clock3 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Recent activity</p>
            {order ? (
              <p className="mt-1 max-w-full truncate text-sm font-bold text-ink">
                {order.orderNumber} with {order.business.name}
              </p>
            ) : (
              <p className="mt-1 text-sm font-bold text-ink">No bookings recorded yet</p>
            )}
            <p className="mt-1 text-xs font-semibold text-slate-500">{order ? formatDate(order.createdAt) : "New bookings will appear here."}</p>
          </div>
        </div>
        {order && (
          <Link
            href={`/order/${order.publicToken}`}
            className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-ocean/30 hover:text-ocean sm:w-auto"
          >
            View booking
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
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
      action={<ButtonLink href="/user" variant="secondary" icon={<Home className="size-4" />}>Dashboard / Home</ButtonLink>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={<CalendarCheck2 className="size-5" />} label="Total bookings" value={String(orders.length)} detail="Latest 100 records" tone="ink" />
        <SummaryTile icon={<ReceiptText className="size-5" />} label="Active" value={String(activeBookings)} detail="Open status updates" tone="ocean" />
        <SummaryTile icon={<WalletCards className="size-5" />} label="Pending payments" value={String(pendingPayments)} detail="Awaiting payment confirmation" tone="amber" />
        <SummaryTile icon={<WalletCards className="size-5" />} label="Total value" value={formatINR(totalSpent)} detail="Across matched bookings" tone="emerald" />
      </div>

      <Card className="mt-5 overflow-hidden bg-white p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">Booking history</h2>
          <p className="mt-1 text-sm text-slate-500">Sorted by most recent activity.</p>
        </div>
        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-mist text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Booking</th>
                  <th className="px-5 py-3 font-bold">Business</th>
                  <th className="px-5 py-3 font-bold">Items</th>
                  <th className="px-5 py-3 font-bold">Type</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Payment</th>
                  <th className="px-5 py-3 text-right font-bold">Amount</th>
                  <th className="px-5 py-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orderPagination.pageItems.map((order) => (
                  <tr key={order.id} className="align-top transition hover:bg-mist/60">
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink">{order.orderNumber}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(order.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/b/${order.business.slug}`} className="font-bold text-ocean hover:text-ink">{order.business.name}</Link>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="size-3.5" />
                        <span>{[order.business.city, order.business.state].filter(Boolean).join(", ") || "Local area"}</span>
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p className="max-w-xs leading-5">{orderItemsSummary(order)}</p>
                      {order.notes && <p className="mt-1 line-clamp-1 max-w-xs text-xs text-slate-500">Note: {order.notes}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-700">
                        {orderTypeLabel(order)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <OrderStatusAnimation
                          status={order.status}
                          businessType={order.business.businessType}
                          orderType={order.orderType}
                          label={getOrderTrackingStatusLabel(order.business.businessType, order.orderType, order.status)}
                          className="size-8"
                        />
                        <StatusPill status={order.status} label={getOrderTrackingStatusLabel(order.business.businessType, order.orderType, order.status)} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <PaymentStatusAnimation status={order.paymentStatus} provider={order.payment?.provider ?? "CASH"} label={`${order.paymentStatus.toLowerCase()} payment`} />
                        <div className="grid gap-1">
                          <StatusPill status={order.paymentStatus} />
                          <span className="text-xs font-semibold text-slate-500">{order.payment?.provider ?? "CASH"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-extrabold">{formatINR(order.totalAmount)}</td>
                    <td className="px-5 py-4">
                      <Link href={`/order/${order.publicToken}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-ocean/30 hover:text-ocean">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid place-items-center px-5 py-14 text-center">
            <div className="grid size-14 place-items-center rounded-lg bg-mist text-ocean">
              <CalendarCheck2 className="size-7" />
            </div>
            <h2 className="mt-4 text-xl font-bold">No bookings yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Bookings made with this account email or phone will appear here.</p>
            <ButtonLink href="/user" className="mt-5" icon={<Home className="size-4" />}>Browse businesses</ButtonLink>
          </div>
        )}
        <PaginationControls
          page={orderPagination.page}
          pageCount={orderPagination.pageCount}
          totalItems={orderPagination.totalItems}
          startItem={orderPagination.startItem}
          endItem={orderPagination.endItem}
          itemLabel="bookings"
          onPageChange={orderPagination.setPage}
        />
      </Card>
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
      action={<ButtonLink href="/user/settings" variant="secondary" icon={<Settings className="size-4" />}>Settings</ButtonLink>}
    >
      <Card className="min-w-0 max-w-full overflow-hidden bg-white p-0">
        <div className="grid min-w-0 max-w-full lg:grid-cols-[minmax(0,410px)_minmax(0,1fr)]">
          <div className="min-w-0 border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-ink text-lg font-extrabold text-white">{initials(user.name)}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 truncate text-2xl font-extrabold">{user.name}</h2>
                  <Badge variant="blue">Customer</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">VyapaarMate account</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm">
              <ProfileLine icon={<Mail className="size-4" />} label="Email" value={user.email} />
              <ProfileLine icon={<Phone className="size-4" />} label="Phone" value={user.phone ?? "Not added"} />
              <ProfileLine icon={<ShieldCheck className="size-4" />} label="Member since" value={formatShortDate(user.createdAt)} />
            </div>
          </div>

          <div className="grid min-w-0 max-w-full content-start gap-4 bg-gradient-to-br from-white to-mist/70 p-4 sm:p-6">
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <ProfileMetric icon={<ReceiptText className="size-5" />} label="Bookings" value={String(orders.length)} detail="Matched to this account" tone="ink" />
              <ProfileMetric icon={<WalletCards className="size-5" />} label="Total value" value={formatINR(totalSpent)} detail="Across booking history" tone="emerald" />
              <ProfileMetric icon={<CalendarCheck2 className="size-5" />} label="Last booking" value={lastBooking ? formatShortDate(lastBooking) : "None"} detail="Most recent record" tone="ocean" />
            </div>
            <LatestBookingPanel order={orders[0]} />
          </div>
        </div>
      </Card>

      <Card className="mt-5 min-w-0 max-w-full overflow-hidden bg-white p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Business profiles</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Customer records created when you booked with each business.</p>
          </div>
          <Badge variant="neutral">{linkedCountLabel}</Badge>
        </div>
        <div className="p-5 sm:p-6">
          {businessProfiles.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <div className="divide-y divide-line">
                {profilePagination.pageItems.map((profile) => {
                  const bookingLabel = profile.totalOrders === 1 ? "booking" : "bookings";

                  return (
                    <div key={profile.id} className="grid gap-4 bg-white px-4 py-4 transition hover:bg-mist/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <Link href={`/b/${profile.business.slug}`} className="inline-flex max-w-full items-center gap-1 text-base font-bold text-ink transition hover:text-ocean">
                          <span className="min-w-0 truncate">{profile.business.name}</span>
                          <ArrowUpRight className="size-3.5 shrink-0" />
                        </Link>
                        <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-600 md:grid-cols-3">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <ReceiptText className="size-4 shrink-0 text-slate-400" />
                            <span className="truncate">{profile.totalOrders} {bookingLabel}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <WalletCards className="size-4 shrink-0 text-slate-400" />
                            <span className="truncate">{formatINR(profile.totalSpent)}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Clock3 className="size-4 shrink-0 text-slate-400" />
                            <span className="truncate">{formatShortDate(profile.lastOrderAt)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Badge variant={profile.whatsappOptIn ? "emerald" : "neutral"}>{profile.whatsappOptIn ? "WhatsApp on" : "WhatsApp off"}</Badge>
                        <Badge variant={profile.marketingOptIn ? "blue" : "neutral"}>{profile.marketingOptIn ? "Offers on" : "Offers off"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid place-items-center rounded-lg border border-dashed border-line bg-mist px-5 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-lg bg-white text-ocean">
                <Building2 className="size-7" />
              </span>
              <h3 className="mt-4 text-lg font-bold">No business profiles linked</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Profiles appear after your first booking with a business.</p>
              <ButtonLink href="/user" className="mt-5" icon={<Home className="size-4" />}>Browse businesses</ButtonLink>
            </div>
          )}
          <PaginationControls
            className="mt-4 rounded-lg border border-line bg-white"
            page={profilePagination.page}
            pageCount={profilePagination.pageCount}
            totalItems={profilePagination.totalItems}
            startItem={profilePagination.startItem}
            endItem={profilePagination.endItem}
            itemLabel="business profiles"
            onPageChange={profilePagination.setPage}
          />
        </div>
      </Card>
    </PortalPageShell>
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
      action={<ButtonLink href="/user/profile" variant="secondary" icon={<UserRound className="size-4" />}>Profile</ButtonLink>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="bg-white">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-ink text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Account access</h2>
              <p className="mt-1 text-sm text-slate-500">Signed-in customer account.</p>
            </div>
          </div>
          <div className="mt-5 divide-y divide-line rounded-lg border border-line">
            <SettingsLine label="Name" value={user.name} />
            <SettingsLine label="Email" value={user.email} />
            <SettingsLine label="Phone" value={user.phone ?? "Not added"} />
            <SettingsLine label="Role" value="Customer" />
          </div>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-ocean text-white">
              <Settings className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Communication status</h2>
              <p className="mt-1 text-sm text-slate-500">Current booking communication flags.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {businessProfiles.length > 0 ? (
              communicationPagination.pageItems.map((profile) => (
                <div key={profile.id} className="rounded-lg border border-line bg-mist p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{profile.business.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{profile.totalOrders} bookings</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={profile.whatsappOptIn ? "emerald" : "neutral"}>WhatsApp {profile.whatsappOptIn ? "enabled" : "disabled"}</Badge>
                    <Badge variant={profile.marketingOptIn ? "blue" : "neutral"}>Offers {profile.marketingOptIn ? "enabled" : "disabled"}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-line bg-mist p-4 text-sm font-semibold text-slate-600">No communication settings are linked yet.</p>
            )}
          </div>
          <PaginationControls
            className="mt-4 rounded-lg border border-line bg-white"
            page={communicationPagination.page}
            pageCount={communicationPagination.pageCount}
            totalItems={communicationPagination.totalItems}
            startItem={communicationPagination.startItem}
            endItem={communicationPagination.endItem}
            itemLabel="business profiles"
            onPageChange={communicationPagination.setPage}
          />
        </Card>

        <PasswordChangeCard
          portal="user"
          title="User password"
          body="Change the password used for user portal sign-in."
        />
      </div>
    </PortalPageShell>
  );
}

function ProfileLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-line bg-mist px-3 py-2.5">
      <span className="grid size-8 place-items-center rounded-md bg-white text-ocean">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="font-semibold leading-5 text-slate-700 [overflow-wrap:anywhere]">{value}</p>
      </div>
    </div>
  );
}

function SettingsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:items-center">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="min-w-0 truncate text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
