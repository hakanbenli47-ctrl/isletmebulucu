import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { DEFAULT_SETTINGS } from "@/data/defaults";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "@/data/sectors";
import { TURKIYE_ILLERI } from "@/data/turkiye-illeri";
import { OpenDataPlacesError, searchPlaces } from "@/lib/openstreetmap/client";
import { advanceSearchPosition } from "@/lib/places/progress";
import { orderPotentialPlaces, withPotential } from "@/lib/places/potential";
import { createQualificationDiagnostics, formatQualificationSummary, qualifySearchResults } from "@/lib/places/qualification";
import { enrichInstagramActivity } from "@/lib/instagram/client";
import { mockSearch, mockStore } from "@/lib/mock-data";
import { normalizePhoneSearch } from "@/lib/phone-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseSutunuEksikMi } from "@/lib/supabase/errors";
import type { LeadRecord, LeadType, PlaceDetails } from "@/types";

const inputSchema = z.object({
  leadType: z.enum(["website", "accounting"]),
  province: z.enum(TURKIYE_ILLERI).optional(),
  sector: z.string().trim().min(2).max(100).optional(),
  quality: z.enum(["recommended", "selective", "broad"]).default("recommended"),
  presence: z.enum(["all", "instagram", "no_social"]).default("all"),
});

const LEAD_SELECT = "id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at,data_source,details_cache,details_cached_at";
const LEGACY_LEAD_SELECT = "id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at";

async function allExistingLeadKeys(userId: string) {
  const supabase = await createSupabaseServerClient();
  const placeIds: string[] = [];
  const mobiles: string[] = [];
  for (let from = 0; ; from += 1000) {
    const indexedResult = await supabase.from("lead_records").select("place_id,phone_normalized").eq("user_id", userId).range(from, from + 999);
    const result = supabaseSutunuEksikMi(indexedResult.error, "phone_normalized")
      ? await supabase.from("lead_records").select("place_id").eq("user_id", userId).range(from, from + 999)
      : indexedResult;
    const { data, error } = result;
    if (error) throw error;
    placeIds.push(...(data ?? []).map((item) => item.place_id));
    mobiles.push(...(data ?? []).flatMap((item) => "phone_normalized" in item && typeof item.phone_normalized === "string" ? [item.phone_normalized] : []));
    if (!data || data.length < 1000) break;
  }
  return { placeIds, mobiles };
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const { leadType, province: requestedProvince, sector: requestedSector, quality, presence } = inputSchema.parse(await request.json());

    if (isMockMode()) {
      const target = mockStore.settings.resultsPerSearch;
      const leads = mockSearch(leadType, target);
      return Response.json({ leads, found: leads.length, requested: target, apiCalls: 1, limited: leads.length < target, message: `Demo taramasında ${leads.length} yeni işletme bulundu.` });
    }

    const supabase = await createSupabaseServerClient();
    const [{ data: settingsRow }, { data: stateRow }, existing] = await Promise.all([
      supabase.from("app_settings").select("results_per_search,website_sectors,accounting_sectors").eq("user_id", user.id).maybeSingle(),
      supabase.from("search_states").select("province_index,sector_index").eq("user_id", user.id).eq("lead_type", leadType).maybeSingle(),
      allExistingLeadKeys(user.id),
    ]);

    const target = Math.min(50, Math.max(1, settingsRow?.results_per_search ?? DEFAULT_SETTINGS.resultsPerSearch));
    const allowedSectors = leadType === "website" ? WEBSITE_SECTORS : ACCOUNTING_SECTORS;
    const storedSectors = (leadType === "website" ? settingsRow?.website_sectors : settingsRow?.accounting_sectors) as unknown;
    const activeSectors = sanitizeSectors(storedSectors, allowedSectors);
    if (!activeSectors.length) return Response.json({ error: "Bu aday türü için en az bir aktif sektör seçin." }, { status: 400 });
    if (requestedSector && !activeSectors.includes(requestedSector)) {
      return Response.json({ error: "Seçilen meslek aktif sektörleriniz arasında değil." }, { status: 400 });
    }

    let position = { provinceIndex: stateRow?.province_index ?? 0, sectorIndex: stateRow?.sector_index ?? 0 };
    position.provinceIndex %= TURKIYE_ILLERI.length;
    position.sectorIndex %= activeSectors.length;
    const maxCalls = Math.min(5, Math.max(1, Number(process.env.PLACES_MAX_CALLS_PER_SEARCH) || 3));
    const seen = new Set(existing.placeIds);
    const seenMobiles = new Set(existing.mobiles);
    const diagnostics = createQualificationDiagnostics();
    const found: Array<{ details: PlaceDetails; db: Omit<LeadRecord, "details"> }> = [];
    let apiCalls = 0;
    let filteredProvinceIndex = 0;
    let filteredSectorIndex = 0;
    const filteredSearch = Boolean(requestedProvince || requestedSector);

    try {
      while (apiCalls < maxCalls && found.length < target) {
        const province = requestedProvince ?? (requestedSector ? TURKIYE_ILLERI[filteredProvinceIndex] : TURKIYE_ILLERI[position.provinceIndex]);
        const sector = requestedSector ?? (requestedProvince ? activeSectors[filteredSectorIndex] : activeSectors[position.sectorIndex]);
        const searchResults = await searchPlaces(`${sector}, ${province}, Türkiye`, sector, { province });
        const results = leadType === "website" ? await enrichInstagramActivity(searchResults) : searchResults;
        apiCalls += 1;

        if (requestedProvince && requestedSector) {
          filteredProvinceIndex = TURKIYE_ILLERI.length;
          filteredSectorIndex = activeSectors.length;
        } else if (requestedProvince) {
          filteredSectorIndex += 1;
        } else if (requestedSector) {
          filteredProvinceIndex += 1;
        } else {
          position = advanceSearchPosition(position, TURKIYE_ILLERI.length, activeSectors.length);
        }

        const eligible = qualifySearchResults(orderPotentialPlaces(results, leadType, quality), {
          leadType,
          sector,
          province,
          quality,
          presence,
          seenPlaceIds: seen,
          seenMobiles,
          limit: target - found.length,
          diagnostics,
        });

        if (eligible.length) {
          const inserted = await saveNewLeads(user.id, leadType, province, sector, eligible);
          const byId = new Map(eligible.map((place) => [place.placeId, place]));
          for (const db of inserted) {
            const details = byId.get(db.place_id);
            if (details) found.push({ details, db });
          }
        }

        if (
          (requestedProvince && requestedSector) ||
          (requestedProvince && filteredSectorIndex >= activeSectors.length) ||
          (requestedSector && filteredProvinceIndex >= TURKIYE_ILLERI.length)
        ) break;
      }
    } catch (error) {
      if (error instanceof OpenDataPlacesError) {
        const cached = await cachedUncontactedLeads(user.id, leadType, target, requestedProvince, requestedSector);
        if (cached.length) {
          return Response.json({
            leads: cached,
            found: 0,
            requested: target,
            apiCalls,
            limited: cached.length < target,
            fromCache: true,
            message: `Açık veri servisi geçici olarak yanıt vermedi. Daha önce kaydedilmiş ve mesaj gönderilmemiş ${cached.length} işletme gösteriliyor.`,
          });
        }
      }
      throw error;
    }

    const writes = [
      supabase.from("search_runs").insert({ user_id: user.id, lead_type: leadType, requested_count: target, returned_count: found.length, api_call_count: apiCalls }),
    ];
    if (!filteredSearch) {
      writes.push(supabase.from("search_states").upsert({ user_id: user.id, lead_type: leadType, province_index: position.provinceIndex, sector_index: position.sectorIndex }, { onConflict: "user_id,lead_type" }));
    }
    const writeResults = await Promise.all(writes);
    const writeError = writeResults.find((result) => result.error)?.error;
    if (writeError) throw writeError;

    const detailOrder = new Map(
      orderPotentialPlaces(found.map((item) => item.details), leadType, quality)
        .map((details, index) => [details.placeId, index]),
    );
    const leads = found
      .map(({ db, details }) => ({ ...db, details }))
      .sort((a, b) => (detailOrder.get(a.place_id) ?? 999) - (detailOrder.get(b.place_id) ?? 999));
    const limited = found.length < target;
    const channel = leadType === "website" && presence === "instagram" ? " Instagram bağlantılı" : "";
    const resultLabel = `${found.length}${channel} doğrulanmış yeni işletme bulundu ve kaydedildi.`;
    return Response.json({ leads, found: found.length, requested: target, apiCalls, limited, diagnostics, message: `${resultLabel} ${formatQualificationSummary(diagnostics)}` });
  } catch (error) {
    return apiError(error);
  }
}

async function saveNewLeads(userId: string, leadType: LeadType, province: string, sector: string, places: PlaceDetails[]) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const rows = places.map((place) => ({
    user_id: userId,
    place_id: place.placeId,
    phone_normalized: normalizePhoneSearch(place.internationalPhone ?? place.phone),
    lead_type: leadType,
    status: "new",
    source_province: province,
    source_sector: sector,
    data_source: "openstreetmap",
    details_cache: place,
    details_cached_at: now,
  }));

  let result = await supabase
    .from("lead_records")
    .upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: true })
    .select(LEAD_SELECT);

  if (cacheColumnsMissing(result.error)) {
    const legacyRows = rows.map((row) => ({
      user_id: row.user_id,
      place_id: row.place_id,
      phone_normalized: row.phone_normalized,
      lead_type: row.lead_type,
      status: row.status,
      source_province: row.source_province,
      source_sector: row.source_sector,
    }));
    result = await supabase
      .from("lead_records")
      .upsert(legacyRows, { onConflict: "user_id,place_id", ignoreDuplicates: true })
      .select(LEGACY_LEAD_SELECT);
  }

  if (supabaseSutunuEksikMi(result.error, "phone_normalized")) {
    const oldestRows = rows.map((row) => ({
      user_id: row.user_id,
      place_id: row.place_id,
      lead_type: row.lead_type,
      status: row.status,
      source_province: row.source_province,
      source_sector: row.source_sector,
    }));
    result = await supabase
      .from("lead_records")
      .upsert(oldestRows, { onConflict: "user_id,place_id", ignoreDuplicates: true })
      .select(LEGACY_LEAD_SELECT);
  }

  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as Array<Omit<LeadRecord, "details">>;
}

async function cachedUncontactedLeads(
  userId: string,
  leadType: LeadType,
  limit: number,
  province?: string,
  sector?: string,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("lead_records")
    .select(LEAD_SELECT)
    .eq("user_id", userId)
    .eq("lead_type", leadType)
    .eq("status", "new")
    .not("details_cache", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (province) query = query.eq("source_province", province);
  if (sector) query = query.eq("source_sector", sector);

  const { data, error } = await query;
  if (cacheColumnsMissing(error)) return [];
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (!isPlaceDetails(row.details_cache)) return [];
    const details = withPotential({
      ...row.details_cache,
      province: row.details_cache.province || row.source_province || "",
      sector: row.details_cache.sector || row.source_sector || undefined,
      dataSource: "openstreetmap",
    }, row.lead_type as LeadType);
    return [{ ...row, details } as LeadRecord];
  });
}

function isPlaceDetails(value: unknown): value is PlaceDetails {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<PlaceDetails>;
  return typeof place.placeId === "string" && typeof place.name === "string" && typeof place.address === "string";
}

function cacheColumnsMissing(error: unknown) {
  return supabaseSutunuEksikMi(error, "details_cache") ||
    supabaseSutunuEksikMi(error, "details_cached_at") ||
    supabaseSutunuEksikMi(error, "data_source");
}

function sanitizeSectors(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return [...allowed];
  if (value.some((item) => typeof item === "string" && !allowed.includes(item))) return [...allowed];
  const clean = value.filter((item): item is string => typeof item === "string" && allowed.includes(item));
  return clean.length ? clean : [...allowed];
}
