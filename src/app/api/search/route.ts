import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { DEFAULT_SETTINGS } from "@/data/defaults";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "@/data/sectors";
import { TURKIYE_ILLERI } from "@/data/turkiye-illeri";
import { OpenDataPlacesError, searchPlaces } from "@/lib/openstreetmap/client";
import { buildSearchPriorities, type SearchHistorySignal } from "@/lib/places/search-priority";
import { balancedResultLimit, buildSearchQueue, successfulResultLimit } from "@/lib/places/search-queue";
import { orderPotentialPlaces, withPotential } from "@/lib/places/potential";
import { createQualificationDiagnostics, formatQualificationSummary, qualifySearchResults } from "@/lib/places/qualification";
import { enrichInstagramActivity } from "@/lib/instagram/client";
import { mockSearch, mockStore } from "@/lib/mock-data";
import { normalizeTurkishPhone } from "@/lib/whatsapp";
import { openingRecencyStatus } from "@/lib/places/activity";
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

async function allExistingLeadKeys(userId: string) {
  const supabase = await createSupabaseServerClient();
  const placeIds: string[] = [];
  const mobiles: string[] = [];
  const history: SearchHistorySignal[] = [];
  for (let from = 0; ; from += 1000) {
    const indexedResult = await supabase
      .from("lead_records")
      .select("place_id,phone_normalized,lead_type,status,source_province,source_sector")
      .eq("user_id", userId)
      .range(from, from + 999);
    const result = supabaseSutunuEksikMi(indexedResult.error, "phone_normalized")
      ? await supabase
        .from("lead_records")
        .select("place_id,lead_type,status,source_province,source_sector")
        .eq("user_id", userId)
        .range(from, from + 999)
      : indexedResult;
    const { data, error } = result;
    if (error) throw error;
    placeIds.push(...(data ?? []).map((item) => item.place_id));
    mobiles.push(...(data ?? []).flatMap((item) => "phone_normalized" in item && typeof item.phone_normalized === "string" ? [item.phone_normalized] : []));
    history.push(...(data ?? []).flatMap((item) =>
      typeof item.lead_type === "string" && typeof item.status === "string"
        ? [{
          lead_type: item.lead_type,
          status: item.status,
          source_province: typeof item.source_province === "string" ? item.source_province : null,
          source_sector: typeof item.source_sector === "string" ? item.source_sector : null,
        }]
        : [],
    ));
    if (!data || data.length < 1000) break;
  }
  return { placeIds, mobiles, history };
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

    const priorities = buildSearchPriorities(TURKIYE_ILLERI, activeSectors, existing.history, leadType);
    const isMixedSearch = !requestedProvince && !requestedSector;
    const priorityResultLimit = successfulResultLimit(
      target,
      isMixedSearch && priorities.successfulPairs.length > 0,
    );
    let position = {
      provinceIndex: modulo(stateRow?.province_index ?? 0, priorities.provinces.length),
      sectorIndex: modulo(stateRow?.sector_index ?? 0, priorities.sectors.length),
    };
    const maxCalls = Math.min(12, Math.max(1, Number(process.env.PLACES_MAX_CALLS_PER_SEARCH) || 8));
    const searchQueue = buildSearchQueue({
      requestedProvince,
      requestedSector,
      provinces: priorities.provinces,
      sectors: priorities.sectors,
      successfulPairs: priorities.successfulPairs,
      position,
      maxCalls,
    });
    const seen = new Set(existing.placeIds);
    const seenMobiles = new Set(existing.mobiles);
    const diagnostics = createQualificationDiagnostics();
    const found: Array<{ details: PlaceDetails; db: Omit<LeadRecord, "details"> }> = [];
    let apiCalls = 0;
    let failedCalls = 0;
    let lastOpenDataError: OpenDataPlacesError | null = null;
    const searchedProvinces = new Set<string>();
    const searchedSectors = new Set<string>();
    let currentPoolHasMore = false;
    let priorityFound = 0;
    const deferredPriority: Array<{ province: string; sector: string; candidates: PlaceDetails[] }> = [];
    const deferredCoverage: Array<{ province: string; sector: string; candidates: PlaceDetails[] }> = [];
    const isSectorSweep = !requestedSector && searchQueue.length > 1;
    let sweepCallsRemaining = searchQueue.filter((pair) => pair.mixGroup !== "priority").length;

    for (const { province, sector, cursorAfter, mixGroup } of searchQueue) {
      if (found.length >= target) break;
      const remaining = target - found.length;
      const isSweepPair = isSectorSweep && mixGroup !== "priority";
      const selectionLimit = mixGroup === "priority"
        ? Math.min(remaining, Math.max(0, priorityResultLimit - priorityFound))
        : isSweepPair
          ? balancedResultLimit(remaining, sweepCallsRemaining)
          : remaining;
      if (isSweepPair) sweepCallsRemaining = Math.max(0, sweepCallsRemaining - 1);
      if (selectionLimit <= 0) continue;

      apiCalls += 1;
      searchedProvinces.add(province);
      searchedSectors.add(sector);
      try {
        const searchResults = await searchPlaces(`${sector}, ${province}, Türkiye`, sector, { province });

        const eligible = qualifySearchResults(orderPotentialPlaces(searchResults, leadType, quality), {
          leadType,
          sector,
          province,
          quality,
          presence,
          seenPlaceIds: seen,
          seenMobiles,
          // Bir fazla aday isteyerek aynı ücretsiz sonuç havuzunda devam edecek
          // yeni işletme kalıp kalmadığını veritabanına ek yazı atmadan anlarız.
          // Çok sektörlü taramada tek bir yoğun sektör bütün tabloyu doldurmasın diye
          // sektör başına pay uygular, fazladan adayları son tamamlama için bellekte tutarız.
          limit: mixGroup === "priority" || isSweepPair ? remaining + 1 : selectionLimit + 1,
          diagnostics,
        });
        const selectedCandidates = eligible.slice(0, selectionLimit);
        const poolHasMore = eligible.length > selectedCandidates.length;
        if (mixGroup === "priority" && poolHasMore) {
          deferredPriority.push({ province, sector, candidates: eligible.slice(selectionLimit) });
        } else if (isSweepPair && poolHasMore) {
          deferredCoverage.push({ province, sector, candidates: eligible.slice(selectionLimit) });
        }
        if (!isSectorSweep) currentPoolHasMore = poolHasMore;
        // Instagram canlı kontrolü pahalı olabilir; yüzlerce ham sonuç yerine yalnızca
        // gerçekten gösterilecek küçük aday grubunda çalıştırılır.
        const selected = leadType === "website"
          ? await enrichInstagramActivity(selectedCandidates)
          : selectedCandidates;

        if (selected.length) {
          const inserted = await saveNewLeads(user.id, leadType, province, sector, selected);
          const byId = new Map(selected.map((place) => [place.placeId, place]));
          for (const db of inserted) {
            const details = byId.get(db.place_id);
            if (details) found.push({ details, db });
          }
          if (mixGroup === "priority") priorityFound += inserted.length;
        }
      } catch (error) {
        if (!(error instanceof OpenDataPlacesError)) throw error;
        failedCalls += 1;
        lastOpenDataError = error;
      }
      // Havuzda hedefin dışında yeni aday kaldıysa imleci ilerletmeyiz. Sonraki
      // tıklama aynı önbellekten, daha önce kaydedilenleri atlayarak anında devam eder.
      if (cursorAfter && (isSectorSweep || !currentPoolHasMore)) position = cursorAfter;
      if (!isSectorSweep && currentPoolHasMore) break;
    }

    // Önce farklı sektörlerde bulunan yedeklerle hedef sayıyı tamamlarız; böylece
    // tablo çeşitliliği korunur. Bunlar da yetmezse öncelikli havuz kullanılabilir.
    if (isSectorSweep && found.length < target) {
      for (const batch of deferredCoverage) {
        const candidates = batch.candidates.slice(0, target - found.length);
        if (!candidates.length) continue;
        const selected = leadType === "website"
          ? await enrichInstagramActivity(candidates)
          : candidates;
        const inserted = await saveNewLeads(user.id, leadType, batch.province, batch.sector, selected);
        const byId = new Map(selected.map((place) => [place.placeId, place]));
        for (const db of inserted) {
          const details = byId.get(db.place_id);
          if (details) found.push({ details, db });
        }
        if (found.length >= target) break;
      }
    }

    if (isMixedSearch && found.length < target) {
      for (const batch of deferredPriority) {
        const candidates = batch.candidates.slice(0, target - found.length);
        if (!candidates.length) continue;
        const selected = leadType === "website"
          ? await enrichInstagramActivity(candidates)
          : candidates;
        const inserted = await saveNewLeads(user.id, leadType, batch.province, batch.sector, selected);
        const byId = new Map(selected.map((place) => [place.placeId, place]));
        for (const db of inserted) {
          const details = byId.get(db.place_id);
          if (details) found.push({ details, db });
        }
        priorityFound += inserted.length;
        if (found.length >= target) break;
      }
    }

    if (!found.length && lastOpenDataError && failedCalls === apiCalls) {
      const cached = await cachedUncontactedLeads(user.id, leadType, target, requestedProvince, requestedSector);
      if (cached.length) {
        return Response.json({
          leads: cached,
          found: 0,
          requested: target,
          apiCalls,
          limited: cached.length < target,
          fromCache: true,
          message: `Açık veri servisleri geçici olarak yanıt vermedi. Daha önce kaydedilmiş ve mesaj gönderilmemiş ${cached.length} işletme gösteriliyor.`,
        });
      }
      throw lastOpenDataError;
    }

    const writes = [
      supabase.from("search_runs").insert({ user_id: user.id, lead_type: leadType, requested_count: target, returned_count: found.length, api_call_count: apiCalls }),
    ];
    if (!(requestedProvince && requestedSector)) {
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
    const resultLabel = `${found.length}${channel} uygun, mesaj gönderilmemiş işletme adayı bulundu ve kaydedildi.`;
    const coverageLabel = `${searchedProvinces.size} şehir ve ${searchedSectors.size} sektör için ${apiCalls} açık veri sorgusu denendi.`;
    const continuationLabel = currentPoolHasMore ? " Aynı filtrede sıradaki yeni işletmeler hazır." : "";
    const mixLabel = isMixedSearch
      ? ` Karışım: ${priorityFound} öncelikli, ${Math.max(0, found.length - priorityFound)} genel sektör taraması işletmesi.`
      : "";
    const partialFailureLabel = failedCalls ? ` ${failedCalls} sorgu geçici servis hatası nedeniyle atlandı.` : "";
    return Response.json({
      leads,
      found: found.length,
      requested: target,
      apiCalls,
      limited,
      diagnostics,
      mix: isMixedSearch ? { priority: priorityFound, coverage: Math.max(0, found.length - priorityFound) } : undefined,
      message: `${resultLabel} ${coverageLabel}${mixLabel}${continuationLabel}${partialFailureLabel} ${formatQualificationSummary(diagnostics)}`,
    });
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
    phone_normalized: normalizeTurkishPhone(place.internationalPhone ?? place.phone),
    lead_type: leadType,
    status: "new",
    source_province: province,
    source_sector: sector,
    data_source: "openstreetmap",
    details_cache: place,
    details_cached_at: now,
  }));

  const result = await supabase
    .from("lead_records")
    .upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: true })
    .select(LEAD_SELECT);

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
    if (
      row.details_cache.businessStatus !== "OPERATIONAL" ||
      openingRecencyStatus(row.details_cache.openedAt) === "old" ||
      !normalizeTurkishPhone(row.details_cache.internationalPhone ?? row.details_cache.phone)
    ) return [];
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

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
