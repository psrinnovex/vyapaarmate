"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Gps, Location, SearchNormal1, Shop, WalletMoney } from "@/components/ui/iconsax";
import { BusinessHoursDisclosure } from "@/components/businesses/business-hours-disclosure";
import { useStreamRefresh } from "@/hooks/use-live-sync";
import { isBusinessOpenAt } from "@/lib/business-hours";
import type { PublicBusinessListing } from "@/lib/public-businesses";
import { fulfillmentLabelForBusinessType, type ActiveFulfillmentMode } from "@/lib/business-rules";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { getBusinessConsoleIcons } from "@/lib/business-console-icons";
import { queryBrowserGeolocationPermission, requestBrowserCoordinates } from "@/lib/browser-geolocation";
import { cn, formatINR } from "@/lib/utils";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  return (
    <main className="min-h-screen bg-mist text-ink">
      <section className="border-b border-line bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Badge variant="blue">User view</Badge>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Restaurants, hotels, and local businesses around you</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Browse active VyapaarMate businesses, check who is open now, then view menus, services, products, or classes based on each business type.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[330px]">
            <div className="rounded-lg border border-line bg-mist p-3">
              <p className="text-2xl font-extrabold">{openCount}</p>
              <p className="text-xs font-semibold text-slate-500">open now</p>
            </div>
            <div className="rounded-lg border border-line bg-mist p-3">
              <p className="text-2xl font-extrabold">{whatsappCount}</p>
              <p className="text-xs font-semibold text-slate-500">WhatsApp enabled</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-mist px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              void refreshBusinesses({ query });
            }}
          >
            <SearchNormal1 className="pointer-events-none absolute left-3 top-2.5 size-6 text-slate-400" variant="Bulk" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="pl-11"
              placeholder="Search by business, city, menu item, service, product, or class"
            />
          </form>
          <Button variant="secondary" icon={<SearchNormal1 className="size-5" variant="Bulk" />} onClick={() => refreshBusinesses({ query })} disabled={loading}>
            {loading ? "Searching" : "Search"}
          </Button>
          <Button variant="emerald" icon={<Gps className="size-5" variant="Bulk" />} onClick={useCurrentLocation} disabled={location.status === "loading" || loading}>
            {location.status === "loading" ? "Locating" : "Use My Location"}
          </Button>
          <p className={cn("text-sm font-semibold lg:col-span-3", location.status === "error" ? "text-red-700" : "text-slate-500")}>{location.label}</p>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!hasLocation && !loading ? (
            <div className="col-span-full mx-auto max-w-2xl rounded-lg border border-red-100 bg-white p-8 text-center shadow-sm">
              <Gps className="mx-auto size-12 text-red-600" variant="Bulk" />
              <h2 className="mt-4 text-xl font-bold">Location required</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{location.label}</p>
              {showLocationRequiredAction && (
                <Button className="mt-5" variant="emerald" icon={<Gps className="size-5" variant="Bulk" />} onClick={useCurrentLocation}>
                  Use My Location
                </Button>
              )}
            </div>
          ) : loading ? (
            Array.from({ length: 6 }, (_, index) => (
              <Card key={index} className="flex h-full flex-col bg-white">
                <div className="flex items-start gap-4">
                  <Skeleton className="size-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="mt-3 h-4 w-2/3" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-32 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
                <SkeletonText className="mt-5" lines={3} />
                <div className="mt-5 grid gap-3">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-5/6" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <Skeleton className="mt-5 h-11 w-full rounded-lg" />
              </Card>
            ))
          ) : businessPagination.pageItems.map((business, index) => {
            const copy = getBusinessConsoleCopy(business.businessType);
            const icons = getBusinessConsoleIcons(business.businessType);
            const BusinessIcon = icons.businessIcon;
            const CatalogIcon = icons.catalogIcon;
            const visibleFeaturedItems = business.featuredItems.slice(0, featuredItemBubbleLimit);

            return (
              <ScrollReveal key={business.id} className="h-full" delay={index * 45}>
                <Card className="flex h-full flex-col bg-white">
                  <div className="flex items-start gap-4">
                    <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink text-white">
                      {business.logoUrl ? (
                        <Image
                          src={business.logoUrl}
                          alt={`${business.name} image`}
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={business.logoUrl.toLowerCase().split("?")[0].endsWith(".svg")}
                        />
                      ) : (
                        <BusinessIcon className="size-8" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold">{business.name}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={business.open ? "emerald" : "red"}>{business.open ? "Open now" : "Closed"}</Badge>
                        <Badge variant="blue" className="gap-1.5">
                          <BusinessIcon className="size-4" />
                          {business.businessType}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-12 items-start gap-2 text-sm leading-6 text-slate-600">
                    <Location className="mt-0.5 size-5 shrink-0 text-ocean" variant="Bulk" />
                    <span className="min-w-0 flex-1">{business.address || `${copy.catalogNavLabel} available from ${business.name}.`}</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <BusinessHoursDisclosure businessId={business.id} hours={business.hours} open={business.open} now={now} showSchedule={showBusinessDays} />
                    <p className="leading-6">
                      <span className="font-semibold text-ink">
                        {business.itemCount} {business.itemCount === 1 ? copy.itemSingular.toLowerCase() : copy.itemPlural.toLowerCase()}
                      </span>{" "}
                      - {business.fulfillmentModes.map((mode) => fulfillmentLabel(business.businessType, mode)).join(" / ")}
                    </p>
                    <div className="flex items-center gap-2">
                      <WalletMoney className="size-5 text-ocean" variant="Bulk" />
                      <span>{copy.minimumValueLabel} {formatINR(business.minimumOrder)} - {business.allowsPayOnDelivery ? "Cash available" : "Online payment"}</span>
                    </div>
                  </div>

                  {visibleFeaturedItems.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {visibleFeaturedItems.map((item) => (
                        <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-600">
                          <CatalogIcon className="size-4" />
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/b/${business.slug}`}
                    className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-ocean"
                  >
                    <span>{cardActionLabel(copy.catalogNavLabel)}</span>
                    <ArrowRight className="size-5" variant="Bold" />
                  </Link>
                </Card>
              </ScrollReveal>
            );
          })}
        </div>
        {hasLocation && !loading && (
          <PaginationControls
            className="mx-auto mt-5 max-w-7xl rounded-lg border border-line bg-white"
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
          <div className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-8 text-center shadow-sm">
            <Shop className="mx-auto size-12 text-ocean" variant="Bulk" />
            <h2 className="mt-4 text-xl font-bold">No open businesses found</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Try another city, business type, or item search when more businesses are open.</p>
          </div>
        )}
      </section>
    </main>
  );
}
