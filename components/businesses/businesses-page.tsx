"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Gps, Location, SearchNormal1, WalletMoney } from "@/components/ui/iconsax";
import { ClayIllustration, illustrationNameForBusinessType, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { BusinessHoursDisclosure } from "@/components/businesses/business-hours-disclosure";
import { useStreamRefresh } from "@/hooks/use-live-sync";
import { isBusinessOpenAt } from "@/lib/business-hours";
import type { PublicBusinessListing } from "@/lib/public-businesses";
import { fulfillmentLabelForBusinessType, type ActiveFulfillmentMode } from "@/lib/business-rules";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { queryBrowserGeolocationPermission, requestBrowserCoordinates } from "@/lib/browser-geolocation";
import { cn, formatINR, initials } from "@/lib/utils";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sticker } from "@/components/ui/sticker";
import { PaginationControls, usePaginatedItems } from "@/components/ui/pagination";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

type BusinessesResponse = {
  businesses?: PublicBusinessListing[];
  error?: unknown;
};

type LocationState =
  | { status: "idle"; label: string }
  | { status: "loading"; label: string }
  | { status: "ready"; label: string }
  | { status: "error"; label: string };
type UserCoordinates = { latitude: number; longitude: number };

const locationRequiredMessage = "Turn on Location and allow access to show nearby businesses.";
const locationPermissionPromptMessage = "Location permission is not given yet. Use My Location and allow access to show nearby businesses.";
const locationPermissionBlockedMessage = "Location is blocked for this site. Turn on Location in your browser or device settings, then try Use My Location again.";
const locationUnavailableMessage = "Could not read your location. Turn on device location services, allow browser access, and try Use My Location again.";
const featuredItemBubbleLimit = 3;

const quickFilters: { label: string; term: string; art: ClayIllustrationName }[] = [
  { label: "All", term: "", art: "shop" },
  { label: "Tiffin", term: "tiffin", art: "tiffin" },
  { label: "Restaurants", term: "restaurant", art: "bowl" },
  { label: "Bakery", term: "bakery", art: "cake" },
  { label: "Juice", term: "juice", art: "juice" },
  { label: "Salon", term: "salon", art: "salon" },
  { label: "Grocery", term: "grocery", art: "grocery" }
];

/** Storefront awning: stripes with a scalloped edge (one bump per stripe). */
const awningMask =
  "linear-gradient(#000 0 0) top / 100% calc(100% - 0.4rem) no-repeat, radial-gradient(circle 0.4rem at 50% 50%, #000 96%, transparent 100%) bottom / 0.8rem 0.8rem repeat-x";
/** Stripe colours for the storefront awning on each card. */
const awningColors = ["#1ec926", "#f2a20c", "#0e7c86", "#0b0d0b", "#d8432e", "#12a51a"];

function fulfillmentLabel(businessType: string, mode: string) {
  return fulfillmentLabelForBusinessType(businessType, mode as ActiveFulfillmentMode) ?? mode;
}

function cardActionLabel(catalogLabel: string) {
  return `View ${catalogLabel}`;
}

export function BusinessesPage({
  showBusinessDays = true,
  showLocationRequiredAction = true
}: {
  showBusinessDays?: boolean;
  showLocationRequiredAction?: boolean;
}) {
  const [businesses, setBusinesses] = useState<PublicBusinessListing[]>([]);
  const [query, setQuery] = useState("");
  const [coordinates, setCoordinates] = useState<UserCoordinates | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: "error", label: locationRequiredMessage });
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    function syncPermissionNotice(state: PermissionState) {
      if (state === "denied" || state === "prompt") {
        setCoordinates(null);
        setBusinesses([]);
      }

      setLocation((current) => {
        if (state === "denied") return { status: "error", label: locationPermissionBlockedMessage };
        if (state === "prompt") return { status: "error", label: locationPermissionPromptMessage };
        if (current.status === "loading" || current.status === "ready") return current;
        if (current.status === "error" && (current.label === locationRequiredMessage || current.label.startsWith("Location"))) {
          return { status: "idle", label: "Location access is allowed. Use My Location to show nearby businesses." };
        }
        return current;
      });
    }

    async function checkPermission() {
      permissionStatus = await queryBrowserGeolocationPermission();
      if (cancelled || !permissionStatus) return;

      syncPermissionNotice(permissionStatus.state);
      permissionStatus.onchange = () => {
        if (!permissionStatus) return;
        syncPermissionNotice(permissionStatus.state);
      };
    }

    void checkPermission();

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshBusinesses = useCallback(async (params: { latitude?: number; longitude?: number; query?: string }) => {
    const searchParams = new URLSearchParams();
    const latitude = params.latitude ?? coordinates?.latitude;
    const longitude = params.longitude ?? coordinates?.longitude;

    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setCoordinates(null);
      setBusinesses([]);
      setLocation({ status: "error", label: locationRequiredMessage });
      return;
    }

    searchParams.set("lat", String(latitude));
    searchParams.set("lng", String(longitude));
    if (params.query?.trim()) searchParams.set("q", params.query.trim());

    setLoading(true);
    try {
      const response = await fetch(`/api/businesses?${searchParams.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as BusinessesResponse;
      if (!response.ok || !Array.isArray(payload.businesses)) {
        setBusinesses([]);
        setLocation({ status: "error", label: typeof payload.error === "string" ? payload.error : "Could not refresh businesses." });
        return;
      }

      setBusinesses(payload.businesses);
    } catch {
      setBusinesses([]);
      setLocation({ status: "error", label: "Could not refresh businesses. Check your connection." });
    } finally {
      setLoading(false);
    }
  }, [coordinates?.latitude, coordinates?.longitude]);

  useStreamRefresh({
    url: "/api/businesses",
    eventName: "businesses",
    onRefresh: () => refreshBusinesses({ query }),
    enabled: coordinates !== null
  });

  useEffect(() => {
    if (!coordinates) return;

    const timer = window.setInterval(() => {
      void refreshBusinesses({ query });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [coordinates, query, refreshBusinesses]);

  async function useCurrentLocation() {
    setLocation({ status: "loading", label: "Reading your location" });
    setCoordinates(null);
    setBusinesses([]);
    const result = await requestBrowserCoordinates({
      deniedMessage: locationPermissionBlockedMessage,
      locationOffMessage: "Turn on Location for this device and allow browser access to show nearby businesses.",
      unavailableMessage: locationUnavailableMessage
    });

    if (!result.ok) {
      setLocation({ status: "error", label: result.message });
      return;
    }

    const nextCoordinates = result.coordinates;
    setCoordinates(nextCoordinates);
    setLocation({ status: "ready", label: "Showing open businesses inside your area" });
    void refreshBusinesses({
      latitude: nextCoordinates.latitude,
      longitude: nextCoordinates.longitude,
      query
    });
  }

  const visibleBusinesses = useMemo(
    () => businesses.filter((business) => business.open && isBusinessOpenAt(business.hours, now)),
    [businesses, now]
  );
  const openCount = visibleBusinesses.length;
  const whatsappCount = useMemo(() => visibleBusinesses.filter((business) => business.whatsappAvailable).length, [visibleBusinesses]);
  const businessPagination = usePaginatedItems(visibleBusinesses, {
    resetKey: `${visibleBusinesses.length}-${visibleBusinesses[0]?.id ?? "empty"}-${visibleBusinesses.at(-1)?.id ?? "empty"}`
  });
  const hasLocation = coordinates !== null && location.status === "ready";

  function searchFor(term: string) {
    setQuery(term);
    void refreshBusinesses({ query: term });
  }

  return (
    <main className="min-h-screen overflow-x-clip text-ink">
      <section className="px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95)_0%,rgba(243,238,226,0.9)_52%,rgba(216,246,210,0.85)_100%)] p-5 shadow-clay sm:p-8 lg:p-10">
          <div aria-hidden="true" className="vm-blob -right-10 -top-16 size-72 bg-marigold-400 opacity-40" />
          <div aria-hidden="true" className="vm-blob -bottom-20 left-1/3 size-72 bg-brand opacity-30" />
          <div className="relative grid items-center gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="min-w-0">
              <Sticker tone="peacock" tilt={-3}>Near you</Sticker>
              <h1 className="mt-4 text-[clamp(1.9rem,4.6vw,3.3rem)] font-extrabold leading-[1.03] tracking-[-0.045em]">
                Restaurants, hotels, and local businesses <span className="vm-mark">around you</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-ink-600 sm:text-base">
                Browse active VyapaarMate businesses, check who is open now, then view menus, services, products, or classes based on each business type.
              </p>

              <form
                className="glass mt-6 flex items-center gap-2 rounded-[1.6rem] p-2"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  void refreshBusinesses({ query });
                }}
              >
                <SearchNormal1 className="ml-2 size-6 shrink-0 text-ink-500" variant="Bulk" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  aria-label="Search businesses"
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink-500 sm:text-base"
                  placeholder="Search by business, city, menu item, service, product, or class"
                />
                <Button type="submit" variant="dark" disabled={loading} className="shrink-0">
                  {loading ? "Searching" : "Search"}
                </Button>
              </form>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden" role="group" aria-label="Quick filters">
                {quickFilters.map((filter) => {
                  const selected = query.trim().toLowerCase() === filter.term;
                  return (
                    <button
                      key={filter.label}
                      type="button"
                      onClick={() => searchFor(filter.term)}
                      aria-pressed={selected}
                      disabled={loading}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-bold transition",
                        selected ? "bg-clay-ink text-white shadow-clay-sm theme-dark" : "bg-white/80 text-ink-600 shadow-clay-sm hover:bg-white"
                      )}
                    >
                      <span className="size-7 rounded-full bg-ivory-100 p-0.5">
                        <ClayIllustration name={filter.art} />
                      </span>
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative mx-auto hidden aspect-square w-full max-w-[19rem] lg:block">
              <div aria-hidden="true" className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_35%_28%,#ffffff_0%,#f3eee2_55%,#e6dfcf_100%)] shadow-clay-inset" />
              <div className="absolute inset-[16%] motion-safe:animate-float-slow">
                <ClayIllustration name="shop" />
              </div>
              <div className="absolute left-0 top-[12%]">
                <Sticker tone="green" tilt={-6}>{openCount} open now</Sticker>
              </div>
              <div className="absolute bottom-[10%] right-0">
                <Sticker tone="paper" tilt={5}>{whatsappCount} on WhatsApp</Sticker>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
              location.status === "error" ? "bg-kumkum-50 text-kumkum-700" : location.status === "ready" ? "bg-green-50 text-green-700" : "bg-white/80 text-ink-600"
            )}
          >
            <Location className="size-5 shrink-0" variant="Bulk" />
            {location.label}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-extrabold text-ink shadow-clay-sm lg:hidden">
              {openCount} open · {whatsappCount} WhatsApp
            </span>
            <Button variant="brand" icon={<Gps className="size-5" variant="Bulk" />} onClick={useCurrentLocation} disabled={location.status === "loading" || loading}>
              {location.status === "loading" ? "Locating" : "Use My Location"}
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {!hasLocation && !loading ? (
            <div className="clay col-span-full mx-auto w-full max-w-2xl rounded-[2.25rem] p-8 text-center">
              <div className="relative mx-auto grid size-28 place-items-center">
                <span aria-hidden="true" className="absolute inset-0 rounded-full bg-brand/15 motion-safe:animate-ping [animation-duration:2.4s]" />
                <span aria-hidden="true" className="absolute inset-4 rounded-full bg-brand/20" />
                <span className="clay-orb relative size-16 rounded-full bg-clay-green text-ink">
                  <Gps className="size-8" variant="Bulk" />
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.03em]">Location required</h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-ink-600">{location.label}</p>
              {showLocationRequiredAction && (
                <Button className="mt-6" size="lg" variant="brand" icon={<Gps className="size-5" variant="Bulk" />} onClick={useCurrentLocation}>
                  Use My Location
                </Button>
              )}
            </div>
          ) : loading ? (
            Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="clay flex h-full flex-col overflow-hidden rounded-[2rem]">
                <Skeleton className="h-32 rounded-none" />
                <div className="p-5">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="mt-3 flex gap-2">
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </div>
                  <SkeletonText className="mt-5" lines={3} />
                  <Skeleton className="mt-5 h-12 w-full rounded-2xl" />
                </div>
              </div>
            ))
          ) : businessPagination.pageItems.map((business, index) => {
            const copy = getBusinessConsoleCopy(business.businessType);
            const icons = getBusinessConsoleIcons(business.businessType);
            const BusinessIcon = icons.businessIcon;
            const CatalogIcon = icons.catalogIcon;
            const visibleFeaturedItems = business.featuredItems.slice(0, featuredItemBubbleLimit);
            const art = illustrationNameForBusinessType(business.businessType);
            const awning = awningColors[index % awningColors.length];

            return (
              <ScrollReveal key={business.id} className="h-full" delay={index * 45}>
                <article className="clay group flex h-full flex-col overflow-hidden rounded-[2rem] transition hover:-translate-y-1 hover:shadow-clay-lg">
                  <div className="relative h-32 bg-[linear-gradient(180deg,#fffdf8,#f3eee2)]">
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-7"
                      style={{
                        backgroundImage: `repeating-linear-gradient(90deg, ${awning} 0 0.8rem, #ffffff 0.8rem 1.6rem)`,
                        WebkitMask: awningMask,
                        mask: awningMask
                      }}
                    />
                    <div className="absolute bottom-0 left-5 size-[4.5rem] translate-y-1/3 overflow-hidden rounded-[1.4rem] border-4 border-white bg-white shadow-clay-sm">
                      {business.logoUrl ? (
                        <Image
                          src={business.logoUrl}
                          alt={`${business.name} image`}
                          fill
                          sizes="72px"
                          className="object-cover"
                          unoptimized={business.logoUrl.toLowerCase().split("?")[0].endsWith(".svg")}
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-lg font-extrabold text-white" style={{ background: `linear-gradient(160deg, ${awning}, #0b0d0b)` }}>
                          {initials(business.name)}
                        </span>
                      )}
                    </div>
                    <div aria-hidden="true" className="absolute bottom-1 right-4 w-24 transition duration-500 group-hover:-translate-y-1 group-hover:rotate-3">
                      <ClayIllustration name={art} />
                    </div>
                    <span
                      className={cn(
                        "absolute left-5 top-9 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-clay-sm",
                        business.open ? "bg-brand text-ink" : "bg-kumkum-700 text-white"
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full bg-white", business.open && "motion-safe:animate-pulse")} />
                      {business.open ? "Open now" : "Closed"}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5 pt-8">
                    <h2 className="truncate text-xl font-extrabold tracking-[-0.02em]">{business.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-peacock-700">
                      <BusinessIcon className="size-4" />
                      {business.businessType}
                    </p>

                    <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-ink-600">
                      <Location className="mt-0.5 size-5 shrink-0 text-brand-text" variant="Bulk" />
                      <span className="min-w-0 flex-1">{business.address || `${copy.catalogNavLabel} available from ${business.name}.`}</span>
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                      <span className="rounded-2xl bg-ivory-100/80 px-3 py-2.5 text-ink-600">
                        <span className="block text-lg font-extrabold leading-6 text-ink">{business.itemCount}</span>
                        {business.itemCount === 1 ? copy.itemSingular.toLowerCase() : copy.itemPlural.toLowerCase()}
                      </span>
                      <span className="rounded-2xl bg-ivory-100/80 px-3 py-2.5 text-ink-600">
                        <span className="block text-lg font-extrabold leading-6 text-ink">{formatINR(business.minimumOrder)}</span>
                        {copy.minimumValueLabel.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-500">
                      <WalletMoney className="size-4 text-brand-text" variant="Bulk" />
                      {business.allowsPayOnDelivery ? "Cash available" : "Online payment"}
                      <span aria-hidden="true">·</span>
                      {business.fulfillmentModes.map((mode) => fulfillmentLabel(business.businessType, mode)).join(" / ")}
                    </p>

                    <div className="mt-3 text-sm text-ink-600">
                      <BusinessHoursDisclosure businessId={business.id} hours={business.hours} open={business.open} now={now} showSchedule={showBusinessDays} />
                    </div>

                    {visibleFeaturedItems.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {visibleFeaturedItems.map((item) => (
                          <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-600 shadow-clay-sm">
                            <CatalogIcon className="size-4 text-green-700" />
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-5">
                      <ButtonLink href={`/b/${business.slug}`} variant="dark" className="w-full" icon={<ArrowRight className="size-5" variant="Bold" />} iconPosition="end">
                        {cardActionLabel(copy.catalogNavLabel)}
                      </ButtonLink>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>
        {hasLocation && !loading && (
          <PaginationControls
            className="mx-auto mt-6 max-w-7xl rounded-2xl border border-white/80 bg-white shadow-clay-sm"
            page={businessPagination.page}
            pageCount={businessPagination.pageCount}
            totalItems={businessPagination.totalItems}
            startItem={businessPagination.startItem}
            endItem={businessPagination.endItem}
            itemLabel="businesses"
            onPageChange={businessPagination.setPage}
          />
        )}

        {hasLocation && !loading && visibleBusinesses.length === 0 && (
          <EmptyState
            className="mx-auto mt-2 max-w-2xl"
            illustration="shop"
            title="No open businesses found"
            body="Try another city, business type, or item search when more businesses are open."
          />
        )}
      </section>
    </main>
  );
}
