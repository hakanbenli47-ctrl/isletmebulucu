import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { DEFAULT_SETTINGS } from "@/data/defaults";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "@/data/sectors";
import { TURKIYE_ILLERI } from "@/data/turkiye-illeri";
import { searchPlaces } from "@/lib/google-places/client";
import { filterNewPlaceIds } from "@/lib/google-places/dedupe";
import { advanceSearchPosition } from "@/lib/google-places/progress";
import { isIndependentWebsite, isInstagramProfile, socialProfileType } from "@/lib/google-places/website";
import { assessPotential, orderPotentialPlaces } from "@/lib/google-places/potential";
import { enrichInstagramActivity } from "@/lib/instagram/client";
import { mockSearch, mockStore } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    const found: Array<{ details: PlaceDetails; db: Omit<LeadRecord, "details"> }> = [];
    let apiCalls = 0;
    let filteredProvinceIndex = 0;
    let filteredSectorIndex = 0;
    const filteredSearch = Boolean(requestedProvince || requestedSector);

    while (apiCalls < maxCalls && found.length < target) {
      const province = requestedProvince ?? (requestedSector ? TURKIYE_ILLERI[filteredProvinceIndex] : TURKIYE_ILLERI[position.provinceIndex]);
      const sector = requestedSector ?? (requestedProvince ? activeSectors[filteredSectorIndex] : activeSectors[position.sectorIndex]);
      const searchResults = await searchPlaces(`${sector} ${province}`, sector, province);
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

      const eligible = filterNewPlaceIds(
        orderPotentialPlaces(results.filter((place) =>
          place.businessStatus === "OPERATIONAL" &&
          Boolean(place.phone || place.internationalPhone) &&
          (leadType === "accounting" || !isIndependentWebsite(place.websiteUri)) &&
          matchesPresence(place.websiteUri, leadType, presence) &&
          assessPotential(place, leadType, quality).eligible,
        ), leadType),
        seen,
      ).slice(0, target - found.length);

      if (eligible.length) {
        const rows = eligible.map((place) => ({ user_id: user.id, place_id: place.placeId, lead_type: leadType, status: "new", source_province: province, source_sector: sector }));
        const { data: inserted, error } = await supabase.from("lead_records").upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: true }).select("id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at");
        if (error) throw error;
        const byId = new Map(eligible.map((place) => [place.placeId, place]));
        for (const db of inserted ?? []) {
          const details = byId.get(db.place_id);
          if (details) found.push({ details, db: db as Omit<LeadRecord, "details"> });
        }
        eligible.forEach((place) => seen.add(place.placeId));
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
      orderPotentialPlaces(found.map((item) => item.details), leadType)
        .map((details, index) => [details.placeId, index]),
    );
    const leads = found
      .map(({ db, details }) => ({ ...db, details }))
      .sort((a, b) => (detailOrder.get(a.place_id) ?? 999) - (detailOrder.get(b.place_id) ?? 999));
    const limited = found.length < target;
    const channel = leadType === "website" && presence === "instagram" ? " Instagram bağlantılı" : "";
    return Response.json({ leads, found: found.length, requested: target, apiCalls, limited, message: limited ? `Bu taramada ${found.length}${channel} yeni işletme bulundu. Seçilen kanal filtresine uymayan işletmeler gösterilmedi.` : `${found.length}${channel} yeni işletme bulundu.` });
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

function matchesPresence(uri: string | null | undefined, leadType: "website" | "accounting", presence: "all" | "instagram" | "no_social") {
  if (leadType === "accounting" || presence === "all") return true;
  if (presence === "instagram") return isInstagramProfile(uri);
  return socialProfileType(uri) === null;
}
