import "server-only";
import { normalizeTurkishPhone } from "@/lib/whatsapp";
import { normalizePhoneSearch } from "@/lib/phone-search";
import { isOpenedWithinLastTwoYears } from "@/lib/places/activity";
import type { PlaceDetails } from "@/types";

const DEFAULT_API_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_CACHE_MS = 30 * 60 * 1000;
const LOOKUP_CACHE_MS = 24 * 60 * 60 * 1000;
const REQUEST_GAP_MS = 1_100;
const REQUEST_TIMEOUT_MS = 15_000;
const BUSINESS_CATEGORIES = new Set([
  "amenity", "shop", "office", "craft", "healthcare", "leisure",
  "tourism", "industrial", "man_made",
]);

const SECTOR_SELECTORS: Record<string, string[]> = {
  "Oto yıkama": ['["amenity"="car_wash"]'],
  "Oto detaylandırma": ['["name"~"oto detay|detailing|detaylandırma",i]'],
  "Araç kaplama": ['["name"~"araç kaplama|oto kaplama|folyo kaplama|car wrap",i]'],
  "Cam balkon": ['["name"~"cam balkon",i]'],
  Tente: ['["name"~"tente",i]'],
  Tadilat: ['["name"~"tadilat|yapı dekorasyon",i]'],
  Dekorasyon: ['["office"="interior_design"]', '["name"~"dekorasyon|iç mimar",i]'],
  "Temizlik şirketi": ['["office"="cleaning"]', '["name"~"temizlik",i]'],
  "Koltuk yıkama": ['["name"~"koltuk yıkama",i]'],
  "Halı yıkama": ['["name"~"halı yıkama",i]'],
  İlaçlama: ['["craft"="pest_control"]', '["name"~"ilaçlama|pest control",i]'],
  "Güzellik salonu": ['["shop"="beauty"]'],
  Kuaför: ['["shop"="hairdresser"]'],
  Berber: ['["shop"="hairdresser"]["hairdresser"="male"]', '["name"~"berber",i]'],
  Diyetisyen: ['["healthcare"="dietitian"]', '["name"~"diyetisyen|beslenme danışman",i]'],
  Psikolog: ['["healthcare"="psychotherapist"]', '["name"~"psikolog|psikoterapi",i]'],
  Fizyoterapist: ['["healthcare"="physiotherapist"]', '["name"~"fizyoterapi",i]'],
  "Diş kliniği": ['["amenity"="dentist"]'],
  "Veteriner kliniği": ['["amenity"="veterinary"]'],
  "Emlak danışmanı": ['["office"="estate_agent"]'],
  "Mimarlık ofisi": ['["office"="architect"]'],
  Fotoğrafçı: ['["craft"="photographer"]', '["shop"="photo"]'],
  "Düğün salonu": ['["amenity"="events_venue"]', '["name"~"düğün salonu|event|dav(et|et)",i]'],
  "Spor salonu": ['["leisure"="fitness_centre"]'],
  Anaokulu: ['["amenity"="kindergarten"]'],
  "Özel eğitim kursu": ['["office"="educational_institution"]', '["name"~"eğitim|kurs|akademi",i]'],
  Matbaa: ['["craft"="printer"]', '["shop"="copyshop"]'],
  Çiçekçi: ['["shop"="florist"]'],
  Pastane: ['["shop"="pastry"]', '["shop"="bakery"]'],
  Mobilyacı: ['["shop"="furniture"]'],
  Elektrikçi: ['["craft"="electrician"]'],
  Tesisatçı: ['["craft"="plumber"]'],
  "Kombi servisi": ['["craft"="heating_engineer"]', '["name"~"kombi|ısıtma",i]'],
  Nakliyat: ['["office"="moving_company"]', '["name"~"nakliyat|evden eve",i]'],
  Transfer: ['["office"="logistics"]', '["name"~"transfer|taşımacılık",i]'],
  "Araç kiralama": ['["amenity"="car_rental"]'],
  "Gıda toptancısı": ['["shop"="wholesale"]', '["name"~"gıda.*toptan|toptan.*gıda|erzak",i]'],
  "İçecek toptancısı": ['["shop"="beverages"]', '["name"~"içecek|meşrubat",i]'],
  "Temizlik malzemeleri toptancısı": ['["name"~"temizlik.*(toptan|malzeme)|deterjan",i]'],
  "Ambalaj malzemeleri toptancısı": ['["name"~"ambalaj|paketleme",i]'],
  "Oto yedek parça toptancısı": ['["shop"="car_parts"]'],
  "Hırdavat toptancısı": ['["shop"="hardware"]'],
  "Yapı malzemeleri toptancısı": ['["shop"="trade"]', '["name"~"yapı malzeme|inşaat malzeme",i]'],
  "Elektrik malzemeleri toptancısı": ['["shop"="electrical"]', '["name"~"elektrik malzeme",i]'],
  "Tekstil toptancısı": ['["name"~"tekstil|kumaş",i]'],
  "Kırtasiye toptancısı": ['["shop"="stationery"]'],
  "Medikal malzeme tedarikçisi": ['["shop"="medical_supply"]', '["name"~"medikal|tıbbi malzeme",i]'],
  "Endüstriyel malzeme tedarikçisi": ['["name"~"endüstriyel|sanayi malzeme",i]'],
  "Mobilya üreticisi": ['["craft"="cabinet_maker"]', '["name"~"mobilya",i]'],
  "Plastik ürün üreticisi": ['["name"~"plastik",i]'],
  "Yem bayisi": ['["shop"="agrarian"]', '["name"~"yem",i]'],
  "Tarım ürünleri toptancısı": ['["shop"="agrarian"]', '["name"~"tarım|ziraat",i]'],
  Toptancı: ['["shop"="wholesale"]', '["name"~"toptan",i]'],
  "Dağıtım firması": ['["office"="logistics"]', '["name"~"dağıtım|lojistik",i]'],
};

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
};

const globalState = globalThis as GlobalNominatimState;
const responseCache = globalState.__nominatimCache ??= new Map();
const overpassCache = globalState.__overpassCache ??= new Map();
globalState.__nominatimQueue ??= Promise.resolve();
globalState.__nominatimLastRequestAt ??= 0;

export class OpenDataPlacesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OpenDataPlacesError";
  }
}

export interface PlaceSearchOptions {
  province?: string;
}

export async function searchPlaces(query: string, sector: string, options: PlaceSearchOptions = {}) {
  const province = options.province || provinceFromQuery(query);
  if (!province) throw new OpenDataPlacesError(400, "OpenStreetMap araması için şehir seçilemedi.");
  const places = await overpassSearch(sector, province);
  return places
    .map((place) => mapOverpassPlace(place, { sector, province }))
    .filter((place): place is PlaceDetails => Boolean(place));
}

function mapOverpassPlace(
  element: OverpassElement,
  context: { sector: string; province: string },
): PlaceDetails | null {
  const tags = element.tags ?? {};
  if (!element.type || !element.id || !tags.name) return null;
  const rawPhone = firstPhone(tags);
  const mobile = normalizeTurkishPhone(rawPhone);
  const normalizedPhone = normalizePhoneSearch(rawPhone);
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
    phone: rawPhone,
    internationalPhone: mobile ? `+${mobile}` : normalizedPhone ? `+${normalizedPhone}` : rawPhone,
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
  };
}

async function overpassSearch(sector: string, province: string): Promise<OverpassElement[]> {
  const selectors = SECTOR_SELECTORS[sector] ?? [`["name"~"${escapeOverpassRegex(sector)}",i]`];
  const phoneFilter = '[~"^(contact:)?(mobile|phone|telephone|whatsapp|cell|gsm)$"~"."]';
  const query = [
    "[out:json][timeout:25];",
    `area["boundary"="administrative"]["name"="${escapeOverpassString(province)}"]->.searchArea;`,
    "(",
    ...selectors.flatMap((selector) => [
      `nwr${selector}${phoneFilter}["start_date"](area.searchArea);`,
      `nwr${selector}${phoneFilter}["opening_date"](area.searchArea);`,
    ]),
    ");",
    "out center meta 80;",
  ].join("\n");
  const apiUrl = process.env.OVERPASS_API_URL || DEFAULT_OVERPASS_API_URL;
  const cacheKey = `recent-openings-v2|${apiUrl}|${province}|${sector}`;
  const cached = overpassCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  let response: Response;
  try {
    response = await fetch(apiUrl, {
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
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new OpenDataPlacesError(503, timedOut
      ? "Ücretsiz OpenStreetMap araması zaman aşımına uğradı. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek."
      : "Ücretsiz OpenStreetMap aramasına ulaşılamıyor. Kayıtlı ve mesaj gönderilmemiş adaylar gösterilecek.");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new OpenDataPlacesError(response.status === 429 ? 429 : 503, `Ücretsiz OpenStreetMap araması geçici hata verdi (${response.status}).`);
  }
  const data = await response.json() as { elements?: OverpassElement[] };
  const value = uniqueOverpassElements(data.elements ?? []);
  overpassCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_MS, value });
  return value;
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
  const rawPhone = firstPhone(tags);
  const mobile = normalizeTurkishPhone(rawPhone);
  const normalizedPhone = normalizePhoneSearch(rawPhone);
  const activity = activityFromTags(tags);
  const province = context.province ?? addressProvince(place.address);
  const primaryType = place.type || place.category || "business";
  const placeId = `osm:${place.osm_type}:${place.osm_id}`;

  return {
    placeId,
    name,
    address: place.display_name ?? province ?? "Adres bilgisi yok",
    province: province ?? "",
    phone: rawPhone,
    internationalPhone: mobile ? `+${mobile}` : normalizedPhone ? `+${normalizedPhone}` : rawPhone,
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

function firstPhone(tags: Record<string, string>) {
  const values = [
    tags["contact:mobile"], tags.mobile,
    tags["contact:whatsapp"], tags.whatsapp,
    tags["contact:phone"], tags.phone,
    tags["contact:telephone"], tags.telephone,
    tags["contact:cell"], tags.cell,
    tags["contact:gsm"], tags.gsm,
  ]
    .filter((value): value is string => Boolean(value));
  const candidates = values
    .flatMap((value) => value.split(/[;,|]/))
    .map((item) => item.trim().replace(/\s*(?:ext\.?|dahili|x)\s*\d+$/i, ""))
    .filter(Boolean);
  return candidates.find((value) => normalizeTurkishPhone(value)) ??
    candidates.find((value) => normalizePhoneSearch(value)) ??
    candidates[0] ??
    null;
}

function firstWebsite(tags: Record<string, string>) {
  const website = tags["contact:website"] || tags.website || tags.url;
  if (website) return normalizeUrl(website);
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

function escapeOverpassRegex(value: string) {
  return escapeOverpassString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function activityFromTags(tags: Record<string, string>, elementTimestamp?: string) {
  const openedAt = tags.opening_date || tags.start_date;
  const closed = hasClosedLifecycle(tags);
  const lastVerifiedAt = tags["check_date:opening_hours"] || tags.check_date || tags["survey:date"] || elementTimestamp;
  const recentlyOpened = isOpenedWithinLastTwoYears(openedAt);
  const confidence = closed ? "unknown" : recentlyOpened ? "strong" : tags.opening_hours ? "likely" : "unknown";
  const reason = closed
    ? "Açık veri kaydında kapanış veya terk edilme işareti var"
    : recentlyOpened
      ? `Açılış tarihi ${openedAt} · kapanış işareti yok`
      : "Son iki yıllık doğrulanabilir açılış tarihi bulunamadı";
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
