import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { getVisiblePlaceDetails } from "@/lib/google-places/client";
import { orderPotentialPlaces, withPotential } from "@/lib/google-places/potential";
import { mockStore } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadRecord } from "@/types";

const querySchema = z.object({
  status: z.enum(["new", "contacted", "not_suitable", "no_whatsapp", "customer", "archived"]).default("new"),
  leadType: z.enum(["website", "accounting"]).optional(),
  period: z.enum(["today", "week", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(10),
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
      const filtered = mockStore.records.filter((record) =>
        record.status === params.status &&
        (!params.leadType || record.lead_type === params.leadType) &&
        (!since || Boolean(record.contacted_at && record.contacted_at >= since)),
      );
      return Response.json({ leads: filtered.slice(from, from + params.pageSize), total: filtered.length, stats: mockStats(), warning: null });
    }

    const supabase = await createSupabaseServerClient();
    let query = supabase.from("lead_records").select("id,place_id,lead_type,status,contacted_at,created_at", { count: "exact" }).eq("user_id", user.id).eq("status", params.status).order(params.status === "contacted" ? "contacted_at" : "created_at", { ascending: false }).range(from, from + params.pageSize - 1);
    if (params.leadType) query = query.eq("lead_type", params.leadType);
    const since = sinceFor(params.period);
    if (since) query = query.gte("contacted_at", since);
    const { data, count, error } = await query;
    if (error) throw error;
    const [detailBatch, stats] = await Promise.all([
      getVisiblePlaceDetails((data ?? []).map((record) => record.place_id)),
      realStats(user.id),
    ]);
    const details = detailBatch.places;
    const detailsById = new Map(details.map((place) => [place.placeId, place]));
    let leads = (data ?? []).map((record) => {
      const detail = detailsById.get(record.place_id);
      return { ...record, details: detail ? withPotential(detail, record.lead_type) : detail };
    }) as LeadRecord[];
    if (params.leadType) {
      const detailOrder = new Map(
        orderPotentialPlaces(leads.map((lead) => lead.details), params.leadType)
          .map((detail, index) => [detail.placeId, index]),
      );
      leads = leads.sort((a, b) => (detailOrder.get(a.place_id) ?? 999) - (detailOrder.get(b.place_id) ?? 999));
    }
    const warning = detailBatch.failedCount
      ? detailBatch.quotaLimited
        ? `${detailBatch.failedCount} işletmenin detayı Google kotası nedeniyle alınamadı. Kayıtlarınız kaybolmadı; kota yenilendiğinde sayfayı tekrar açın.`
        : `${detailBatch.failedCount} işletmenin detayı geçici olarak alınamadı.`
      : null;
    return Response.json({ leads, total: count ?? 0, stats, warning });
  } catch (error) {
    return apiError(error);
  }
}

function mockStats() {
  const contacted = mockStore.records.filter((item) => item.contacted_at);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(); week.setDate(week.getDate() - 7);
  return { today: contacted.filter((item) => new Date(item.contacted_at!) >= today).length, week: contacted.filter((item) => new Date(item.contacted_at!) >= week).length, total: contacted.length, customers: mockStore.records.filter((item) => item.status === "customer").length };
}

async function realStats(userId: string) {
  const supabase = await createSupabaseServerClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(); week.setDate(week.getDate() - 7);
  const [todayResult, weekResult, totalResult, customerResult] = await Promise.all([
    supabase.from("lead_records").select("id", { count: "exact", head: true }).eq("user_id", userId).not("contacted_at", "is", null).gte("contacted_at", today.toISOString()),
    supabase.from("lead_records").select("id", { count: "exact", head: true }).eq("user_id", userId).not("contacted_at", "is", null).gte("contacted_at", week.toISOString()),
    supabase.from("lead_records").select("id", { count: "exact", head: true }).eq("user_id", userId).not("contacted_at", "is", null),
    supabase.from("lead_records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "customer"),
  ]);
  return { today: todayResult.count ?? 0, week: weekResult.count ?? 0, total: totalResult.count ?? 0, customers: customerResult.count ?? 0 };
}
