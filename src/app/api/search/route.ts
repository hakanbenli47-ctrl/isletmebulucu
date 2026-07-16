import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { DEFAULT_SETTINGS } from "@/data/defaults";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "@/data/sectors";
import { TURKIYE_ILLERI } from "@/data/turkiye-illeri";
import { searchPlaces } from "@/lib/google-places/client";
import { advanceSearchPosition } from "@/lib/google-places/progress";
import { orderPotentialPlaces } from "@/lib/google-places/potential";
import { createQualificationDiagnostics, formatQualificationSummary, qualifySearchResults } from "@/lib/google-places/qualification";
import { includedTypeForSector } from "@/lib/google-places/relevance";
import { enrichInstagramActivity } from "@/lib/instagram/client";
import { mockSearch, mockStore } from "@/lib/mock-data";
import { normalizePhoneSearch } from "@/lib/phone-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseSutunuEksikMi } from "@/lib/supabase/errors";
import type { LeadRecord, PlaceDetails } from "@/types";

const inputSchema = z.object({
  leadType: z.enum(["website", "accounting"]),
  province: z.enum(TURKIYE_ILLERI).optional(),
  sector: z.string().trim().min(2).max(100).optional(),
  quality: z.enum(["recommended", "selective", "broad"]).default("recommended"),
  presence: z.enum(["all", "instagram", "no_social"]).default("all"),
});

async function allExistingPlaceIds(userId: string) {
  const supabase = await createSupabaseServerClient();
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("lead_records").select("place_id").eq("user_id", userId).range(from, from + 999);
    if (error) throw error;
    ids.push(...(data ?? []).map((item) => item.place_id));
    if (!data || data.length < 1000) break;
  }
  return ids;
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
    const [{ data: settingsRow }, { data: stateRow }, existingIds] = await Promise.all([
      supabase.from("app_settings").select("results_per_search,website_sectors,accounting_sectors").eq("user_id", user.id).maybeSingle(),
      supabase.from("search_states").select("province_index,sector_index").eq("user_id", user.id).eq("lead_type", leadType).maybeSingle(),
      allExistingPlaceIds(user.id),
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
    const maxCalls = Math.min(100, Math.max(1, Number(process.env.GOOGLE_PLACES_MAX_CALLS_PER_SEARCH) || 20));
    const seen = new Set(existingIds);
    const seenMobiles = new Set<string>();
    const diagnostics = createQualificationDiagnostics();
    const found: Array<{ details: PlaceDetails; db: Omit<LeadRecord, "details"> }> = [];
    let apiCalls = 0;
    let filteredProvinceIndex = 0;
    let filteredSectorIndex = 0;
    const filteredSearch = Boolean(requestedProvince || requestedSector);

    while (apiCalls < maxCalls && found.length < target) {
      const province = requestedProvince ?? (requestedSector ? TURKIYE_ILLERI[filteredProvinceIndex] : TURKIYE_ILLERI[position.provinceIndex]);
      const sector = requestedSector ?? (requestedProvince ? activeSectors[filteredSectorIndex] : activeSectors[position.sectorIndex]);
      const searchResults = await searchPlaces(`${sector}, ${province}, Türkiye`, sector, {
        minRating: minimumRatingForSearch(leadType, quality),
        includedType: includedTypeForSector(sector),
        includePureServiceAreaBusinesses: leadType === "website",
      });
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
        const rows = eligible.map((place) => ({
          user_id: user.id,
          place_id: place.placeId,
          phone_normalized: normalizePhoneSearch(place.internationalPhone ?? place.phone),
          lead_type: leadType,
          status: "new",
          source_province: province,
          source_sector: sector,
        }));
        let insertResult = await supabase.from("lead_records").upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: true }).select("id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at");

        if (supabaseSutunuEksikMi(insertResult.error, "phone_normalized")) {
          const eskiSemayaUygunSatirlar = rows.map((row) => ({
            user_id: row.user_id,
            place_id: row.place_id,
            lead_type: row.lead_type,
            status: row.status,
            source_province: row.source_province,
            source_sector: row.source_sector,
          }));
          insertResult = await supabase.from("lead_records").upsert(eskiSemayaUygunSatirlar, { onConflict: "user_id,place_id", ignoreDuplicates: true }).select("id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at");
        }

        if (insertResult.error) throw insertResult.error;
        const byId = new Map(eligible.map((place) => [place.placeId, place]));
        for (const db of insertResult.data ?? []) {
          const details = byId.get(db.place_id);
          if (details) found.push({ details, db: db as Omit<LeadRecord, "details"> });
        }
      }

      if (
        (requestedProvince && requestedSector) ||
        (requestedProvince && filteredSectorIndex >= activeSectors.length) ||
        (requestedSector && filteredProvinceIndex >= TURKIYE_ILLERI.length)
      ) break;
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
    const resultLabel = `${found.length}${channel} doğrulanmış yeni işletme bulundu.`;
    return Response.json({ leads, found: found.length, requested: target, apiCalls, limited, diagnostics, message: `${resultLabel} ${formatQualificationSummary(diagnostics)}` });
  } catch (error) {
    return apiError(error);
  }
}

function sanitizeSectors(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return [...allowed];
  if (value.some((item) => typeof item === "string" && !allowed.includes(item))) return [...allowed];
  const clean = value.filter((item): item is string => typeof item === "string" && allowed.includes(item));
  return clean.length ? clean : [...allowed];
}

function minimumRatingForSearch(leadType: "website" | "accounting", quality: "recommended" | "selective" | "broad") {
  if (leadType === "website") return quality === "broad" ? 3.5 : 4;
  if (quality === "selective") return 4;
  return quality === "broad" ? 3 : 3.5;
}
