import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { getVisiblePlaceDetails } from "@/lib/google-places/client";
import { orderPotentialPlaces, withPotential } from "@/lib/google-places/potential";
import { enrichInstagramActivity } from "@/lib/instagram/client";
import { mockStore } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadRecord, LeadStatus, LeadType, PlaceDetails } from "@/types";

const DB_STATUSES = ["new", "contacted", "replied", "interested", "demo_sent", "follow_up", "not_suitable", "no_whatsapp", "opted_out", "customer", "archived"] as const;
const PIPELINE_STATUSES: LeadStatus[] = ["contacted", "replied", "interested", "demo_sent", "follow_up"];
const REPLY_STATUSES: LeadStatus[] = ["replied", "interested", "demo_sent", "customer"];
const INTERESTED_STATUSES: LeadStatus[] = ["interested", "demo_sent", "customer"];

const querySchema = z.object({
  status: z.enum([...DB_STATUSES, "pipeline", "due"]).default("new"),
  leadType: z.enum(["website", "accounting"]).optional(),
  period: z.enum(["today", "week", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

function sinceFor(period: "today" | "week" | "all") {
  if (period === "all") return null;
  const date = new Date();
  if (period === "today") date.setHours(0, 0, 0, 0);
  else date.setDate(date.getDate() - 7);
  return date.toISOString();
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const from = (params.page - 1) * params.pageSize;

    if (isMockMode()) {
      const since = sinceFor(params.period);
      const filtered = mockStore.records
        .filter((record) => matchesStatus(record, params.status))
        .filter((record) => !params.leadType || record.lead_type === params.leadType)
        .filter((record) => !since || Boolean(record.contacted_at && record.contacted_at >= since));
      return Response.json({ leads: filtered.slice(from, from + params.pageSize), total: filtered.length, stats: calculateStats(mockStore.records, mockStore.settings.dailyContactGoal), warning: null });
    }

    const supabase = await createSupabaseServerClient();
    const orderColumn = params.status === "due" ? "next_follow_up_at" : params.status === "new" ? "created_at" : "contacted_at";
    let query = supabase
      .from("lead_records")
      .select("id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order(orderColumn, { ascending: params.status === "due", nullsFirst: false })
      .range(from, from + params.pageSize - 1);

    if (params.status === "pipeline") query = query.in("status", PIPELINE_STATUSES);
    else if (params.status === "due") query = query.in("status", PIPELINE_STATUSES).not("next_follow_up_at", "is", null).lte("next_follow_up_at", endOfToday());
    else query = query.eq("status", params.status);
    if (params.leadType) query = query.eq("lead_type", params.leadType);
    const since = sinceFor(params.period);
    if (since && params.status !== "due") query = query.gte("contacted_at", since);

    const { data, count, error } = await query;
    if (error) throw error;
    const [detailBatch, stats] = await Promise.all([
      getVisiblePlaceDetails((data ?? []).map((record) => record.place_id)),
      realStats(user.id),
    ]);
    const visiblePlaces = await enrichInstagramActivity(detailBatch.places);
    const detailsById = new Map(visiblePlaces.map((place) => [place.placeId, place]));
    let leads = (data ?? []).map((record) => {
      const detail = detailsById.get(record.place_id) ?? unavailablePlace(record.place_id, record.source_province, record.source_sector);
      return { ...record, details: withPotential(detail, record.lead_type as LeadType) } as LeadRecord;
    });
    if (params.leadType) {
      const detailOrder = new Map(orderPotentialPlaces(leads.map((lead) => lead.details), params.leadType).map((detail, index) => [detail.placeId, index]));
      leads = leads.sort((a, b) => (detailOrder.get(a.place_id) ?? 999) - (detailOrder.get(b.place_id) ?? 999));
    }
    const warning = detailBatch.failedCount
      ? detailBatch.quotaLimited
        ? `${detailBatch.failedCount} işletmenin canlı Google detayı kota nedeniyle gösterilemedi. Satış kayıtları ve notlarınız güvende.`
        : `${detailBatch.failedCount} işletmenin canlı detayı geçici olarak alınamadı.`
      : null;
    return Response.json({ leads, total: count ?? 0, stats, warning });
  } catch (error) {
    return apiError(error);
  }
}

function matchesStatus(record: LeadRecord, status: (typeof querySchema)['_output']['status']) {
  if (status === "pipeline") return PIPELINE_STATUSES.includes(record.status);
  if (status === "due") return PIPELINE_STATUSES.includes(record.status) && Boolean(record.next_follow_up_at && record.next_follow_up_at <= endOfToday());
  return record.status === status;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function unavailablePlace(placeId: string, province: string | null, sector: string | null): PlaceDetails {
  return {
    placeId,
    name: "İşletme detayı kota yenilenince görünecek",
    address: province ?? "Konum bilgisi bekleniyor",
    province: province ?? "",
    phone: null,
    internationalPhone: null,
    websiteUri: null,
    googleMapsUri: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
    businessStatus: "UNKNOWN",
    primaryType: sector ?? "business",
    sector: sector ?? undefined,
    rating: null,
    userRatingCount: 0,
  };
}

type StatRow = Pick<LeadRecord, "status" | "contacted_at" | "next_follow_up_at" | "lead_type" | "source_province" | "source_sector">;

function calculateStats(rows: StatRow[], dailyGoal: number) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(); week.setDate(week.getDate() - 7);
  const contacted = rows.filter((row) => row.contacted_at);
  const customers = rows.filter((row) => row.status === "customer").length;
  const pipeline = Object.fromEntries(DB_STATUSES.map((status) => [status, rows.filter((row) => row.status === status).length]));
  return {
    today: contacted.filter((row) => new Date(row.contacted_at!) >= today).length,
    week: contacted.filter((row) => new Date(row.contacted_at!) >= week).length,
    total: contacted.length,
    replies: rows.filter((row) => REPLY_STATUSES.includes(row.status)).length,
    interested: rows.filter((row) => INTERESTED_STATUSES.includes(row.status)).length,
    customers,
    due: rows.filter((row) => PIPELINE_STATUSES.includes(row.status) && row.next_follow_up_at && row.next_follow_up_at <= endOfToday()).length,
    dailyGoal,
    conversionRate: contacted.length ? Math.round((customers / contacted.length) * 1000) / 10 : 0,
    pipeline,
    segments: segmentStats(rows),
  };
}

function segmentStats(rows: StatRow[]) {
  const groups = new Map<string, { label: string; contacts: number; replies: number; customers: number }>();
  for (const row of rows) {
    if (!row.contacted_at) continue;
    const label = [row.source_sector, row.source_province].filter(Boolean).join(" · ") || "Kaynağı bilinmeyen";
    const group = groups.get(label) ?? { label, contacts: 0, replies: 0, customers: 0 };
    group.contacts += 1;
    if (REPLY_STATUSES.includes(row.status)) group.replies += 1;
    if (row.status === "customer") group.customers += 1;
    groups.set(label, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, responseRate: Math.round((group.replies / group.contacts) * 100) }))
    .sort((a, b) => b.customers - a.customers || b.responseRate - a.responseRate || b.contacts - a.contacts)
    .slice(0, 5);
}

async function realStats(userId: string) {
  const supabase = await createSupabaseServerClient();
  const rows: StatRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("lead_records").select("status,contacted_at,next_follow_up_at,lead_type,source_province,source_sector").eq("user_id", userId).range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as StatRow[]));
    if (!data || data.length < 1000) break;
  }
  const { data: settings, error } = await supabase.from("app_settings").select("daily_contact_goal").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return calculateStats(rows, settings?.daily_contact_goal ?? 20);
}
