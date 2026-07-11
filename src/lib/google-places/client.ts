import "server-only";
import type { PlaceDetails } from "@/types";

const SEARCH_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
  "places.nationalPhoneNumber", "places.internationalPhoneNumber", "places.websiteUri",
  "places.googleMapsUri", "places.businessStatus", "places.primaryType",
  "places.rating", "places.userRatingCount",
].join(",");

const DETAIL_FIELDS = SEARCH_FIELDS.replaceAll("places.", "");

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
}

function apiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Google Places API anahtarı tanımlı değil.");
  return key;
}

function mapPlace(place: GooglePlace, sector?: string, fallbackProvince = ""): PlaceDetails | null {
  if (!place.id) return null;
  const province = place.addressComponents?.find((item) =>
    item.types?.includes("administrative_area_level_1"),
  )?.longText ?? fallbackProvince;
  return {
    placeId: place.id,
    name: place.displayName?.text ?? "İsimsiz işletme",
    address: place.formattedAddress ?? "Adres bilgisi yok",
    province,
    phone: place.nationalPhoneNumber ?? null,
    internationalPhone: place.internationalPhoneNumber ?? null,
    websiteUri: place.websiteUri ?? null,
    googleMapsUri: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.id)}`,
    businessStatus: place.businessStatus ?? "UNKNOWN",
    primaryType: place.primaryType ?? "İşletme",
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? 0,
    sector,
  };
}

async function googleFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places isteği başarısız (${response.status}): ${body.slice(0, 240)}`);
  }
  return response;
}

export async function searchPlaces(query: string, sector: string, province: string) {
  const response = await googleFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "X-Goog-FieldMask": SEARCH_FIELDS },
    body: JSON.stringify({ textQuery: query, languageCode: "tr", regionCode: "TR", pageSize: 20 }),
  });
  const data = (await response.json()) as { places?: GooglePlace[] };
  return (data.places ?? [])
    .map((place) => mapPlace(place, sector, province))
    .filter((place): place is PlaceDetails => Boolean(place));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const response = await googleFetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=tr&regionCode=TR`,
    { headers: { "X-Goog-FieldMask": DETAIL_FIELDS } },
  );
  const mapped = mapPlace((await response.json()) as GooglePlace);
  if (!mapped) throw new Error("Google Places işletme detayı alınamadı.");
  return mapped;
}

export async function getVisiblePlaceDetails(placeIds: string[]) {
  return Promise.all(placeIds.map((placeId) => getPlaceDetails(placeId)));
}
