"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Loader2, LocateFixed, MapPin, Search, Trash2 } from "lucide-react";
import { requestBrowserCoordinates } from "@/lib/browser-geolocation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_MAP_CENTER = { latitude: 20.5937, longitude: 78.9629 };
const DEFAULT_MAP_ZOOM = 5;
const SELECTED_LOCATION_ZOOM = 16;
const missingGoogleMapsApiKeyMessage = "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to load Google Maps.";

type MapCoordinates = {
  latitude: number;
  longitude: number;
};

type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapsListener = {
  remove: () => void;
};

type GoogleMapClickEvent = {
  latLng?: GoogleLatLng | null;
};

type GoogleMap = {
  addListener: (eventName: string, handler: (event?: GoogleMapClickEvent) => void) => GoogleMapsListener;
  getCenter: () => GoogleLatLng | undefined;
  getZoom: () => number | undefined;
  panTo: (position: GoogleLatLngLiteral) => void;
  setCenter: (position: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarker = {
  addListener: (eventName: string, handler: () => void) => GoogleMapsListener;
  getPosition: () => GoogleLatLng | undefined;
  setMap: (map: GoogleMap | null) => void;
  setPosition: (position: GoogleLatLngLiteral | null) => void;
};

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    event: {
      clearInstanceListeners: (instance: unknown) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __vyapaarMateGoogleMaps?: Promise<void>;
  }
}

type LocationSearchResult = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  provider: "google";
};

type BusinessLocationMapPickerProps = {
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
  address?: string;
  city?: string;
  state?: string;
  businessName?: string;
  className?: string;
  mapClassName?: string;
  onAddressSelect?: (address: string) => void;
};

function googleMapsBrowserKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    ""
  );
}

function loadGoogleMapsScript(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps can only load in the browser."));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (window.__vyapaarMateGoogleMaps) return window.__vyapaarMateGoogleMaps;

  window.__vyapaarMateGoogleMaps = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });

  return window.__vyapaarMateGoogleMaps;
}

function toGoogleCoordinates(coordinates: MapCoordinates): GoogleLatLngLiteral {
  return {
    lat: coordinates.latitude,
    lng: coordinates.longitude
  };
}

function fromGoogleLatLng(value: GoogleLatLng): MapCoordinates {
  return {
    latitude: value.lat(),
    longitude: value.lng()
  };
}

function formatMapCoordinate(value: number) {
  return value.toFixed(6);
}

function parseSearchResults(payload: unknown): LocationSearchResult[] {
  if (!Array.isArray(payload)) return [];

  return payload.filter((item): item is LocationSearchResult => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<LocationSearchResult>;
    return (
      (typeof candidate.place_id === "number" || typeof candidate.place_id === "string") &&
      typeof candidate.display_name === "string" &&
      typeof candidate.lat === "string" &&
      typeof candidate.lon === "string" &&
      candidate.provider === "google" &&
      Number.isFinite(Number(candidate.lat)) &&
      Number.isFinite(Number(candidate.lon))
    );
  });
}

function buildSuggestedSearch({
  address,
  city,
  state,
  businessName
}: Pick<BusinessLocationMapPickerProps, "address" | "city" | "state" | "businessName">) {
  return [businessName, address, city, state].filter((part) => part && part.trim().length > 0).join(", ");
}

export function BusinessLocationMapPicker({
  defaultLatitude = null,
  defaultLongitude = null,
  address = "",
  city = "",
  state = "",
  businessName = "",
  className,
  mapClassName,
  onAddressSelect
}: BusinessLocationMapPickerProps) {
  const apiKey = googleMapsBrowserKey();
  const initialLocation = useMemo(() => {
    if (
      typeof defaultLatitude === "number" &&
      Number.isFinite(defaultLatitude) &&
      typeof defaultLongitude === "number" &&
      Number.isFinite(defaultLongitude)
    ) {
      return { latitude: defaultLatitude, longitude: defaultLongitude };
    }

    return null;
  }, [defaultLatitude, defaultLongitude]);
  const suggestedSearch = useMemo(
    () => buildSuggestedSearch({ address, city, state, businessName }),
    [address, businessName, city, state]
  );
  const [location, setLocation] = useState<MapCoordinates | null>(initialLocation);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading">("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">(apiKey ? "loading" : "error");
  const [mapError, setMapError] = useState<string | null>(apiKey ? null : missingGoogleMapsApiKeyMessage);
  const searchEditedRef = useRef(false);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);

  const focusMapOnLocation = useCallback((coordinates: MapCoordinates, zoom = SELECTED_LOCATION_ZOOM) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.panTo(toGoogleCoordinates(coordinates));
    map.setZoom(zoom);
  }, []);

  useEffect(() => {
    const mapElement = mapElementRef.current;
    if (!mapElement) return;

    if (!apiKey) return;

    let active = true;

    void loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!active || !window.google?.maps?.Map) return;

        const startingLocation = initialLocation ?? DEFAULT_MAP_CENTER;
        const map = new window.google.maps.Map(mapElement, {
          center: toGoogleCoordinates(startingLocation),
          zoom: initialLocation ? SELECTED_LOCATION_ZOOM : DEFAULT_MAP_ZOOM,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false
        });
        const marker = new window.google.maps.Marker({
          map,
          draggable: true,
          title: "Business location"
        });

        if (initialLocation) {
          marker.setPosition(toGoogleCoordinates(initialLocation));
        }

        map.addListener("click", (event?: GoogleMapClickEvent) => {
          if (!event?.latLng) return;
          setLocation(fromGoogleLatLng(event.latLng));
        });
        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (!position) return;
          setLocation(fromGoogleLatLng(position));
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setMapStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setMapStatus("error");
        setMapError(error instanceof Error ? error.message : "Google Maps could not be loaded.");
      });

    return () => {
      active = false;
      const googleMaps = window.google?.maps;
      if (markerRef.current) {
        googleMaps?.event.clearInstanceListeners(markerRef.current);
        markerRef.current.setMap(null);
      }
      if (mapInstanceRef.current) {
        googleMaps?.event.clearInstanceListeners(mapInstanceRef.current);
      }
      markerRef.current = null;
      mapInstanceRef.current = null;
    };
  }, [apiKey, initialLocation]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    marker.setPosition(location ? toGoogleCoordinates(location) : null);
  }, [location]);

  const searchLocations = useCallback(async () => {
    const query = searchQuery.trim() || (!searchEditedRef.current ? suggestedSearch.trim() : "");
    if (!query) {
      setSearchResults([]);
      setSearchError("Enter an address or landmark.");
      return;
    }

    const params = new URLSearchParams({ q: query });

    setSearchStatus("loading");
    setSearchError(null);

    try {
      const response = await fetch(`/api/location-search?${params.toString()}`, {
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown; results?: unknown } | null;

      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Search failed");
      }

      const results = parseSearchResults(payload?.results);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No matching Google Maps places found.");
      }
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Could not search Google Maps right now.");
    } finally {
      setSearchStatus("idle");
    }
  }, [searchQuery, suggestedSearch]);

  const chooseSearchResult = useCallback(
    (result: LocationSearchResult) => {
      const nextLocation = {
        latitude: Number(result.lat),
        longitude: Number(result.lon)
      };

      setLocation(nextLocation);
      focusMapOnLocation(nextLocation);
      setSearchQuery(result.display_name);
      onAddressSelect?.(result.display_name);
      setSearchResults([]);
      setSearchError(null);
      searchEditedRef.current = true;
    },
    [focusMapOnLocation, onAddressSelect]
  );

  const useBrowserLocation = useCallback(async () => {
    setLocationStatus("loading");
    setLocationError(null);

    const result = await requestBrowserCoordinates({
      positionOptions: { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
      deniedMessage: "Location is blocked for this site. Turn on Location in your browser or device settings, then try again.",
      unavailableMessage: "Could not read your location. Turn on location services, allow access, and try again."
    });

    setLocationStatus("idle");

    if (!result.ok) {
      setLocationError(result.message);
      return;
    }

    const nextLocation = result.coordinates;
    setLocation(nextLocation);
    focusMapOnLocation(nextLocation);
  }, [focusMapOnLocation]);

  const hasLocation = location !== null;

  return (
    <div className={cn("grid gap-3", className)}>
      <input type="hidden" name="latitude" value={location ? formatMapCoordinate(location.latitude) : ""} />
      <input type="hidden" name="longitude" value={location ? formatMapCoordinate(location.longitude) : ""} />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(event) => {
              searchEditedRef.current = true;
              setSearchQuery(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchLocations();
              }
            }}
            className="pl-9"
            aria-label="Search address, landmark, or city"
            placeholder="Search Google Maps"
            autoComplete="street-address"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          icon={searchStatus === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          disabled={searchStatus === "loading"}
          onClick={() => void searchLocations()}
        >
          Search
        </Button>
      </div>
      {searchResults.length > 0 && (
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-sm">
          {searchResults.map((result) => (
            <button
              key={`${result.place_id}-${result.lat}-${result.lon}`}
              type="button"
              className="flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-mist focus:outline-none focus:ring-4 focus:ring-ocean/10"
              onClick={() => chooseSearchResult(result)}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-ocean" />
              <span>{result.display_name}</span>
            </button>
          ))}
          <p className="px-3 py-1 text-xs font-semibold text-slate-500" translate="no">
            Results from Google Maps
          </p>
        </div>
      )}
      {searchError && <p className="text-xs font-semibold text-red-700">{searchError}</p>}
      {locationError && <p className="text-xs font-semibold text-red-700">{locationError}</p>}
      <div
        role="application"
        aria-label="Google business location map"
        data-testid="business-location-map"
        className={cn(
          "relative h-80 overflow-hidden rounded-lg border border-line bg-slate-100 shadow-inner",
          mapClassName
        )}
      >
        <div ref={mapElementRef} className="absolute inset-0" />
        {mapStatus !== "ready" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100/95 p-5 text-center">
            <div>
              {mapStatus === "loading" ? (
                <Loader2 className="mx-auto size-8 animate-spin text-ocean" />
              ) : (
                <MapPin className="mx-auto size-8 text-ocean" />
              )}
              <p className="mt-3 text-sm font-semibold text-ink">
                {mapStatus === "loading" ? "Loading Google Maps" : mapError ?? "Google Maps is not ready."}
              </p>
            </div>
          </div>
        )}
        <div className="absolute right-3 top-3 z-20 grid gap-2">
          <button
            type="button"
            aria-label="Use current location"
            title="Use current location"
            disabled={locationStatus === "loading"}
            className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink shadow-sm transition hover:border-ocean/30 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={useBrowserLocation}
          >
            {locationStatus === "loading" ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Center on selected pin"
            title="Center pin"
            disabled={!location || mapStatus !== "ready"}
            className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink shadow-sm transition hover:border-ocean/30 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (location) focusMapOnLocation(location);
            }}
          >
            <Crosshair className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-stretch">
        <div className="rounded-lg border border-line bg-mist p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Latitude</p>
          <p className="mt-1 font-mono text-sm font-semibold text-ink">{hasLocation ? formatMapCoordinate(location.latitude) : "Not set"}</p>
        </div>
        <div className="rounded-lg border border-line bg-mist p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Longitude</p>
          <p className="mt-1 font-mono text-sm font-semibold text-ink">{hasLocation ? formatMapCoordinate(location.longitude) : "Not set"}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          icon={<Trash2 className="size-4" />}
          className="sm:h-full"
          disabled={!hasLocation}
          onClick={() => setLocation(null)}
        >
          Clear pin
        </Button>
      </div>
    </div>
  );
}
