import "server-only";
import type { PlaceDetails } from "@/types";

const SEARCH_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
  "places.nationalPhoneNumber", "places.internationalPhoneNumber", "places.websiteUri",
  "places.googleMapsUri", "places.businessStatus", "places.primaryType",
  "places.types", "places.googleMapsTypeLabel", "places.rating", "places.userRatingCount",
].join(",");

const DETAIL_FIELDS = SEARCH_FIELDS.replaceAll("places.", "");

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  googleMapsTypeLabel?: string;
  rating?: number;
  userRatingCount?: number;
}

export class GooglePlacesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GooglePlacesError";
  }
}

function apiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Google Places API anahtarı tanımlı değil.");
  return key;
}

function mapPlace(place: GooglePlace, sector?: string): PlaceDetails | null {
  if (!place.id) return null;
  const province = place.addressComponents?.find((item) =>
    item.types?.includes("administrative_area_level_1"),
  )?.longText ?? "";
  const countryCode = place.addressComponents?.find((item) =>
    item.types?.includes("country"),
  )?.shortText?.toUpperCase();
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
    types: place.types ?? [],
    typeLabel: place.googleMapsTypeLabel,
    countryCode,
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
    if (response.status === 429) {
      throw new GooglePlacesError(429, "Google Places günlük veya dakikalık kotası doldu. Kayıtlarınız korundu; kota yenilendiğinde devam edebilirsiniz.");
    }
    if (response.status === 403) {
      throw new GooglePlacesError(403, "Google Places erişimi reddedildi. API anahtarı, Places API (New) ve faturalandırma ayarlarını kontrol edin.");
    }
    if (response.status === 400) {
      throw new GooglePlacesError(400, "Google Places arama isteğini kabul etmedi. Filtrelerinizi değiştirip yeniden deneyin.");
    }
    throw new GooglePlacesError(response.status, `Google Places hizmetine şu anda ulaşılamıyor (${response.status}).`);
  }
  return response;
}

export interface PlaceSearchOptions {
  minRating?: number;
  includedType?: string;
  includePureServiceAreaBusinesses?: boolean;
}

export async function searchPlaces(query: string, sector: string, options: PlaceSearchOptions = {}) {
  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: "tr",
    regionCode: "TR",
    pageSize: 20,
    rankPreference: "RELEVANCE",
    includePureServiceAreaBusinesses: options.includePureServiceAreaBusinesses ?? false,
  };
  if (options.minRating !== undefined) body.minRating = options.minRating;
  if (options.includedType) {
    body.includedType = options.includedType;
    body.strictTypeFiltering = false;
  }
  const response = await googleFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "X-Goog-FieldMask": SEARCH_FIELDS },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { places?: GooglePlace[] };
  return (data.places ?? [])
    .map((place) => mapPlace(place, sector))
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
  const settled = await Promise.allSettled(placeIds.map((placeId) => getPlaceDetails(placeId)));
  let failedCount = 0;
  let quotaLimited = false;
  const places = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    failedCount += 1;
    if (result.reason instanceof GooglePlacesError && result.reason.status === 429) quotaLimited = true;
    return unavailablePlace(placeIds[index]);
  });
  return { places, failedCount, quotaLimited };
}

function unavailablePlace(placeId: string): PlaceDetails {
  return {
    placeId,
    name: "İşletme detayı geçici olarak alınamadı",
    address: "Google kotası veya bağlantısı yenilendiğinde tekrar gösterilecek.",
    province: "",
    phone: null,
    internationalPhone: null,
    websiteUri: null,
    googleMapsUri: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
    businessStatus: "UNKNOWN",
    primaryType: "İşletme",
    rating: null,
    userRatingCount: 0,
  };
}
