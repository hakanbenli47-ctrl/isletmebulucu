import "server-only";
import { TURKIYE_IL_ISO_KODLARI, type TurkiyeIli } from "@/data/turkiye-illeri";
import { contactFromOsmTags, isWhatsAppLink } from "@/lib/openstreetmap/contact";
import { selectorsForSector } from "@/lib/openstreetmap/sector-selectors";
import { buildOverpassSearchQuery } from "@/lib/openstreetmap/query";
import { openingRecencyStatus } from "@/lib/places/activity";
import { OpenDataPlacesError } from "@/lib/places/error";
import type { PlaceDetails } from "@/types";

const DEFAULT_API_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_OVERPASS_FAST_URL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter";
const DEFAULT_OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_OVERPASS_FALLBACK_URL = "https://overpass.private.coffee/api/interpreter";
const SEARCH_CACHE_MS = 6 * 60 * 60 * 1000;
const EMPTY_SEARCH_CACHE_MS = 30 * 60 * 1000;
const LOOKUP_CACHE_MS = 24 * 60 * 60 * 1000;
const REQUEST_GAP_MS = 1_100;
const REQUEST_TIMEOUT_MS = 15_000;
const OVERPASS_RESULT_LIMIT = 250;
const OVERPASS_FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
const OVERPASS_REQUEST_TIMEOUT_MS = 6_000;
const OVERPASS_TOTAL_TIMEOUT_MS = 12_000;
const BUSINESS_CATEGORIES = new Set([
  "amenity", "shop", "office", "craft", "healthcare", "leisure",
  "tourism", "industrial", "man_made",
]);

interface NominatimPlace {
  osm_type?: "node" | "way" | "relation";
  osm_id?: number;
  category?: string;
  type?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

interface OverpassElement {
  type?: "node" | "way" | "relation";
  id?: number;
  tags?: Record<string, string>;
  timestamp?: string;
}

type CacheItem<T> = { expiresAt: number; value: T };
type GlobalNominatimState = typeof globalThis & {
  __nominatimCache?: Map<string, CacheItem<NominatimPlace[]>>;
  __nominatimQueue?: Promise<void>;
  __nominatimLastRequestAt?: number;
  __overpassCache?: Map<string, CacheItem<OverpassElement[]>>;
  __overpassInFlight?: Map<string, Promise<OverpassElement[]>>;
  __overpassQueue?: Promise<void>;
  __overpassEndpointBackoff?: Map<string, number>;
};

const globalState = globalThis as GlobalNominatimState;
const responseCache = globalState.__nominatimCache ??= new Map();
const overpassCache = globalState.__overpassCache ??= new Map();
const overpassInFlight = globalState.__overpassInFlight ??= new Map();
const overpassEndpointBackoff = globalState.__overpassEndpointBackoff ??= new Map();
globalState.__overpassQueue ??= Promise.resolve();
globalState.__nominatimQueue ??= Promise.resolve();
globalState.__nominatimLastRequestAt ??= 0;

export interface PlaceSearchOptions {
  province?: string;
}

export async function searchPlaces(query: string, sector: string, options: PlaceSearchOptions = {}) {
  const province = options.province || provinceFromQuery(query);
  if (!province) throw new OpenDataPlacesError(400, "OpenStreetMap araması için şehir seçilemedi.");
  const overpassPlaces = await overpassSearch(sector, province, selectorsForSector(sector));
  return overpassPlaces
    .map((place) => mapOverpassPlace(place, { sector, province }))
    .filter((place): place is PlaceDetails => Boolean(place));
}

function mapOverpassPlace(
  element: OverpassElement,
  context: { sector: string; province: string },
): PlaceDetails | null {
  const tags = element.tags ?? {};
  if (!element.type || !element.id || !tags.name) return null;
  const contact = contactFromOsmTags(tags);
  const primary = primaryOsmType(tags);
  const activity = activityFromTags(tags, element.timestamp);
  const address = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:district"] || tags["addr:suburb"],
    tags["addr:city"] || context.province,
  ].filter(Boolean).join(", ");

  return {
    placeId: `osm:${element.type}:${element.id}`,
    name: tags.name,
    address: address || context.province,
    province: context.province,
    phone: contact.rawPhone,
    internationalPhone: contact.mobile ? `+${contact.mobile}` : contact.fallbackPhone,
    websiteUri: firstWebsite(tags),
    mapUri: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    businessStatus: activity.closed ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
    primaryType: primary.value,
    types: [primary.key, primary.value, `${primary.key}:${primary.value}`],
    typeLabel: context.sector,
    countryCode: "TR",
    rating: null,
    userRatingCount: 0,
    sector: context.sector,
    dataSource: "openstreetmap",
    activityConfidence: activity.confidence,
    activityReason: activity.reason,
    openingHours: tags.opening_hours,
    lastVerifiedAt: activity.lastVerifiedAt,
    openedAt: activity.openedAt,
    whatsappEvidence: contact.whatsappEvidence,
    whatsappReason: contact.whatsappReason,
  };
}

async function overpassSearch(
  sector: string,
  province: string,
  selectors: readonly string[],
): Promise<OverpassElement[]> {
  const provinceIsoCode = TURKIYE_IL_ISO_KODLARI[province as TurkiyeIli];
  const areaSelector = provinceIsoCode
    ? `area["boundary"="administrative"]["ISO3166-2"="${provinceIsoCode}"]->.searchArea;`
    : `area["boundary"="administrative"]["admin_level"="4"]["name"="${escapeOverpassString(province)}"]->.searchArea;`;
  const query = buildOverpassSearchQuery(areaSelector, selectors, OVERPASS_RESULT_LIMIT);
  const apiUrls = overpassApiUrls();
  const cacheKey = `contactable-businesses-v8|${provinceIsoCode ?? province}|${sector}`;
  const cached = overpassCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const activeRequest = overpassInFlight.get(cacheKey);
  if (activeRequest) return activeRequest;

  const request = queueOverpassRequest(() => requestOverpass(apiUrls, query))
    .then((value) => {
      overpassCache.set(cacheKey, { expiresAt: Date.now() + (value.length ? SEARCH_CACHE_MS : EMPTY_SEARCH_CACHE_MS), value });
      return value;
    })
    .finally(() => overpassInFlight.delete(cacheKey));
  overpassInFlight.set(cacheKey, request);
  return request;
}

async function requestOverpass(apiUrls: readonly string[], query: string) {
  let lastStatus = 503;
  let timedOut = false;
  const deadline = Date.now() + OVERPASS_TOTAL_TIMEOUT_MS;
  for (const apiUrl of apiUrls) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 500) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(OVERPASS_REQUEST_TIMEOUT_MS, remainingMs));
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": process.env.NOMINATIM_USER_AGENT || "IsletmeBulucu/1.0",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: controller.signal,
      });
      lastStatus = response.status;
      if (!response.ok) {
        if (response.status === 408 || response.status === 429 || response.status >= 500) {
          markOverpassEndpointFailed(apiUrl);
          continue;
        }
        throw new OpenDataPlacesError(503, `Ücretsiz OpenStreetMap araması isteği kabul etmedi (${response.status}).`);
      }
      const data = await response.json() as { elements?: OverpassElement[] };
      const value = uniqueOverpassElements(data.elements ?? []);
      overpassEndpointBackoff.delete(apiUrl);
      return value;
    } catch (error) {
      if (error instanceof OpenDataPlacesError) throw error;
      timedOut ||= error instanceof Error && error.name === "AbortError";
      markOverpassEndpointFailed(apiUrl);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new OpenDataPlacesError(lastStatus === 429 ? 429 : 503, timedOut
    ? "Ücretsiz OpenStreetMap sunucuları zaman aşımına uğradı. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek."
    : `Ücretsiz OpenStreetMap sunucuları geçici hata verdi (${lastStatus}). Kayıtlı adaylar gösterilecek.`);
}

async function queueOverpassRequest<T>(operation: () => Promise<T>) {
  const previous = globalState.__overpassQueue ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalState.__overpassQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function overpassApiUrls() {
  const configured = (process.env.OVERPASS_API_URLS || process.env.OVERPASS_API_URL || "")
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const urls = [...new Set([...configured, DEFAULT_OVERPASS_FAST_URL, DEFAULT_OVERPASS_FALLBACK_URL, DEFAULT_OVERPASS_API_URL])];
  const now = Date.now();
  const ordered = urls.sort((left, right) =>
    Number((overpassEndpointBackoff.get(left) ?? 0) > now) -
    Number((overpassEndpointBackoff.get(right) ?? 0) > now),
  );
  const healthy = ordered.filter((url) => (overpassEndpointBackoff.get(url) ?? 0) <= now);
  return healthy.length ? healthy : ordered;
}

function markOverpassEndpointFailed(apiUrl: string) {
  overpassEndpointBackoff.set(apiUrl, Date.now() + OVERPASS_FAILURE_COOLDOWN_MS);
}

export async function getVisiblePlaceDetails(placeIds: string[]) {
  if (!placeIds.length) return { places: [], failedCount: 0, quotaLimited: false };

  const validIds = placeIds.filter(isOpenStreetMapPlaceId);
  const byId = new Map<string, PlaceDetails>();
  let quotaLimited = false;

  for (let index = 0; index < validIds.length; index += 50) {
    const batch = validIds.slice(index, index + 50);
    const params = new URLSearchParams({
      osm_ids: batch.map(toLookupId).join(","),
      format: "jsonv2",
      addressdetails: "1",
      extratags: "1",
      namedetails: "1",
    });
    try {
      const rawPlaces = await nominatimRequest(`/lookup?${params}`, LOOKUP_CACHE_MS);
      for (const rawPlace of rawPlaces) {
        const place = mapNominatimPlace(rawPlace);
        if (place) byId.set(place.placeId, place);
      }
    } catch (error) {
      quotaLimited ||= error instanceof OpenDataPlacesError && error.status === 429;
    }
  }

  const places = placeIds.map((placeId) => {
    const place = byId.get(placeId);
    if (place) return place;
    return unavailablePlace(placeId);
  });
  return { places, failedCount: placeIds.filter((placeId) => !byId.has(placeId)).length, quotaLimited };
}

export function mapNominatimPlace(
  place: NominatimPlace,
  context: { sector?: string; province?: string } = {},
): PlaceDetails | null {
  const name = place.name || place.namedetails?.["name:tr"] || place.namedetails?.name;
  if (!place.osm_type || !place.osm_id || !name) return null;
  if (place.category && !BUSINESS_CATEGORIES.has(place.category)) return null;

  const tags = place.extratags ?? {};
  const contact = contactFromOsmTags(tags);
  const activity = activityFromTags(tags);
  const province = context.province ?? addressProvince(place.address);
  const primaryType = place.type || place.category || "business";
  const placeId = `osm:${place.osm_type}:${place.osm_id}`;

  return {
    placeId,
    name,
    address: place.display_name ?? province ?? "Adres bilgisi yok",
    province: province ?? "",
    phone: contact.rawPhone,
    internationalPhone: contact.mobile ? `+${contact.mobile}` : contact.fallbackPhone,
    websiteUri: firstWebsite(tags),
    mapUri: `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`,
    businessStatus: activity.closed ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
    primaryType,
    types: [place.category, place.type, `${place.category}:${place.type}`].filter(
      (value): value is string => Boolean(value && value !== "undefined:undefined"),
    ),
    typeLabel: context.sector ?? humanize(primaryType),
    countryCode: (place.address?.country_code ?? "tr").toUpperCase(),
    rating: null,
    userRatingCount: 0,
    sector: context.sector,
    dataSource: "openstreetmap",
    activityConfidence: activity.confidence,
    activityReason: activity.reason,
    openingHours: tags.opening_hours,
    lastVerifiedAt: activity.lastVerifiedAt,
    openedAt: activity.openedAt,
    whatsappEvidence: contact.whatsappEvidence,
    whatsappReason: contact.whatsappReason,
  };
}

async function nominatimRequest(path: string, ttlMs: number): Promise<NominatimPlace[]> {
  const baseUrl = (process.env.NOMINATIM_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const url = `${baseUrl}${path}`;
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const previous = globalState.__nominatimQueue ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalState.__nominatimQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;

  try {
    const waitMs = Math.max(0, REQUEST_GAP_MS - (Date.now() - (globalState.__nominatimLastRequestAt ?? 0)));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    globalState.__nominatimLastRequestAt = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": process.env.NOMINATIM_USER_AGENT || "IsletmeBulucu/1.0",
          "Accept-Language": "tr",
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Ücretsiz OpenStreetMap servisi zaman aşımına uğradı. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek."
        : "Ücretsiz OpenStreetMap servisine şu anda ulaşılamıyor. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek.";
      throw new OpenDataPlacesError(503, message);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new OpenDataPlacesError(429, "Ücretsiz OpenStreetMap servisinin hız sınırına ulaşıldı. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek.");
      }
      if (response.status === 403) {
        throw new OpenDataPlacesError(503, "Ücretsiz OpenStreetMap servisi isteği kabul etmedi. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek.");
      }
      throw new OpenDataPlacesError(503, `Ücretsiz OpenStreetMap servisi geçici hata verdi (${response.status}).`);
    }

    const value = await response.json() as NominatimPlace[];
    responseCache.set(url, { expiresAt: Date.now() + ttlMs, value });
    return value;
  } finally {
    release();
  }
}

function firstWebsite(tags: Record<string, string>) {
  const website = tags["contact:website"] || tags.website || tags.url;
  if (website && !isWhatsAppLink(website)) return normalizeUrl(website);
  const instagram = tags["contact:instagram"] || tags.instagram;
  if (instagram) return normalizeSocialUrl(instagram, "instagram.com");
  const facebook = tags["contact:facebook"] || tags.facebook;
  return facebook ? normalizeSocialUrl(facebook, "facebook.com") : null;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeSocialUrl(value: string, host: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${host}/${trimmed.replace(/^@/, "")}`;
}

function addressProvince(address?: Record<string, string>) {
  return address?.province || address?.state || address?.city || address?.town || "";
}

function primaryOsmType(tags: Record<string, string>) {
  const keys = ["shop", "office", "craft", "amenity", "healthcare", "leisure", "tourism", "industrial"];
  const key = keys.find((candidate) => tags[candidate]) ?? "business";
  return { key, value: tags[key] || "business" };
}

function provinceFromQuery(query: string) {
  return query.split(",").map((part) => part.trim()).filter(Boolean)[1] || "";
}

function uniqueOverpassElements(elements: OverpassElement[]) {
  const seen = new Set<string>();
  return elements.filter((element) => {
    if (!element.type || !element.id) return false;
    const key = `${element.type}:${element.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeOverpassString(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function activityFromTags(tags: Record<string, string>, elementTimestamp?: string) {
  const openedAt = tags.opening_date || tags.start_date;
  const closed = hasClosedLifecycle(tags);
  const lastVerifiedAt = tags["check_date:opening_hours"] || tags.check_date || tags["survey:date"] || elementTimestamp;
  const recency = openingRecencyStatus(openedAt);
  const recentlyVerified = openingRecencyStatus(lastVerifiedAt) === "recent";
  const confidence = closed ? "unknown" : recency === "recent" ? "strong" : tags.opening_hours || recentlyVerified ? "likely" : "unknown";
  const reason = closed
    ? "Açık veri kaydında kapanış veya terk edilme işareti var"
    : recency === "recent"
      ? `Açılış tarihi ${openedAt} · kapanış işareti yok`
      : recency === "old"
        ? `Açılış tarihi ${openedAt} · son iki yıldan eski`
        : tags.opening_hours || recentlyVerified
          ? "Faal işletme sinyali var · açılış tarihi açık veride kayıtlı değil"
          : "Kapanış işareti yok · açılış tarihi açık veride kayıtlı değil";
  return { closed, confidence: confidence as PlaceDetails["activityConfidence"], reason, lastVerifiedAt, openedAt };
}

function hasClosedLifecycle(tags: Record<string, string>) {
  const explicitClosed = ["disused", "abandoned", "closed", "demolished", "razed", "vacant"]
    .some((key) => ["yes", "true", "closed"].includes(tags[key]?.toLowerCase()));
  const lifecycleKey = Object.keys(tags).some((key) => /^(disused|abandoned|demolished|razed|was):/.test(key));
  const inactiveValue = [tags.shop, tags.office, tags.craft, tags.amenity]
    .some((value) => ["vacant", "closed", "disused", "abandoned"].includes(value?.toLowerCase()));
  const openingHoursClosed = ["closed", "off"].includes(tags.opening_hours?.trim().toLowerCase());
  return explicitClosed || lifecycleKey || inactiveValue || openingHoursClosed || endDateReached(tags.end_date);
}

function endDateReached(value?: string) {
  if (!value) return false;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2] ?? "12");
  const day = Number(match[3] ?? "31");
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

function isOpenStreetMapPlaceId(placeId: string) {
  return /^osm:(node|way|relation):\d+$/.test(placeId);
}

function toLookupId(placeId: string) {
  const [, type, id] = placeId.split(":");
  return `${type === "node" ? "N" : type === "way" ? "W" : "R"}${id}`;
}

function unavailablePlace(placeId: string): PlaceDetails {
  const match = /^osm:(node|way|relation):(\d+)$/.exec(placeId);
  const mapUrl = match ? `https://www.openstreetmap.org/${match[1]}/${match[2]}` : "https://www.openstreetmap.org";
  return {
    placeId,
    name: "İşletme detayı geçici olarak alınamadı",
    address: "Kayıtlı ayrıntılar bulunamadı; ücretsiz açık veri servisi düzelince yenilenecek.",
    province: "",
    phone: null,
    internationalPhone: null,
    websiteUri: null,
    mapUri: mapUrl,
    businessStatus: "UNKNOWN",
    primaryType: "business",
    rating: null,
    userRatingCount: 0,
    dataSource: "openstreetmap",
  };
}
