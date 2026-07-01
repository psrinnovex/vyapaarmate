import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

type SearchResult = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  provider: "google";
};

type GooglePlacesSearchResponse = {
  places?: Array<{
    id?: string;
    name?: string;
    displayName?: {
      text?: string;
    };
    formattedAddress?: string;
    shortFormattedAddress?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

const GOOGLE_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location"
].join(",");

export const dynamic = "force-dynamic";

function parseGooglePlacesResults(payload: GooglePlacesSearchResponse): SearchResult[] {
  if (!Array.isArray(payload.places)) return [];

  return payload.places.flatMap((place): SearchResult[] => {
    const placeId = place.id ?? place.name;
    const name = place.displayName?.text?.trim();
    const address = place.formattedAddress?.trim() || place.shortFormattedAddress?.trim();
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;

    if (
      !placeId ||
      typeof placeId !== "string" ||
      !name ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return [];
    }

    const displayName = address && !address.toLowerCase().includes(name.toLowerCase())
      ? `${name}, ${address}`
      : address || name;

    return [
      {
        place_id: placeId,
        display_name: displayName,
        lat: String(latitude),
        lon: String(longitude),
        provider: "google"
      }
    ];
  });
}

function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

async function searchGooglePlaces(query: string, apiKey: string) {
  const response = await fetch(GOOGLE_PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK
    },
    cache: "no-store",
    body: JSON.stringify({
      textQuery: query,
      languageCode: process.env.GOOGLE_PLACES_LANGUAGE_CODE?.trim() || "en",
      regionCode: process.env.GOOGLE_PLACES_REGION_CODE?.trim() || "IN",
      pageSize: 6
    })
  });

  const payload = (await response.json().catch(() => null)) as GooglePlacesSearchResponse | null;

  if (!response.ok) {
    const googleMessage = payload?.error?.message;
    const message =
      response.status === 403
        ? "Google Places search is not configured correctly. Check the API key, billing, and Places API access."
        : googleMessage || "Could not search Google Places right now.";

    throw new Error(message);
  }

  return parseGooglePlacesResults(payload ?? {});
}

export async function GET(request: Request) {
  const bucket = await rateLimit(`location-search:${getClientIp(request)}`, 30, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many location searches. Try again shortly." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters to search." }, { status: 400 });
  }

  if (query.length > 160) {
    return NextResponse.json({ error: "Search is too long. Try a shorter address or landmark." }, { status: 400 });
  }

  const googlePlacesApiKey = getGooglePlacesApiKey();
  if (!googlePlacesApiKey) {
    return NextResponse.json(
      { error: "Google Places search is not configured. Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY." },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json({ provider: "google", results: await searchGooglePlaces(query, googlePlacesApiKey) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not search locations right now." },
      { status: 502 }
    );
  }
}
