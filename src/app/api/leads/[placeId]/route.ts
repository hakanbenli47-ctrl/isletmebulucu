import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { mockStore } from "@/lib/mock-data";
import { normalizePhoneSearch } from "@/lib/phone-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/types";

const STATUSES = ["new", "contacted", "replied", "interested", "demo_sent", "follow_up", "no_reply", "not_approved", "not_suitable", "no_whatsapp", "opted_out", "customer", "archived"] as const;
const placeIdSchema = z.string().trim().min(3).max(500);
const bodySchema = z.object({
  status: z.enum(STATUSES).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  recordContact: z.boolean().default(false),
  phone: z.string().trim().max(30).refine((value) => normalizePhoneSearch(value) !== null, "Geçerli bir Türkiye telefonu gönderin.").optional(),
}).refine((value) => value.status !== undefined || value.notes !== undefined || value.nextFollowUpAt !== undefined || value.recordContact || value.phone !== undefined, "Güncellenecek bir alan gönderin.");

const CLOSES_FOLLOW_UP: LeadStatus[] = ["no_reply", "not_approved", "not_suitable", "no_whatsapp", "opted_out", "customer", "archived"];

export async function PATCH(request: Request, context: RouteContext<"/api/leads/[placeId]">) {
  try {
    const user = await requireApiUser();
    const { placeId: rawPlaceId } = await context.params;
    const placeId = placeIdSchema.parse(decodeURIComponent(rawPlaceId));
    const input = bodySchema.parse(await request.json());

    if (isMockMode()) {
      const record = mockStore.records.find((item) => item.place_id === placeId);
      if (!record) return Response.json({ error: "İşletme bulunamadı." }, { status: 404 });
      const previousStatus = record.status;
      if (input.status) record.status = input.status;
      if (input.notes !== undefined) record.notes = input.notes;
      if (input.nextFollowUpAt !== undefined) record.next_follow_up_at = input.nextFollowUpAt;
      if (input.recordContact) {
        record.contact_count += 1;
        record.contacted_at ??= new Date().toISOString();
        record.status = input.status ?? (previousStatus === "new" ? "contacted" : "follow_up");
      }
      if (CLOSES_FOLLOW_UP.includes(record.status)) record.next_follow_up_at = null;
      return Response.json({ record });
    }

    const supabase = await createSupabaseServerClient();
    const { data: current, error: currentError } = await supabase
      .from("lead_records")
      .select("id,status,contacted_at,contact_count,notes,next_follow_up_at")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .single();
    if (currentError) throw currentError;

    let status = (input.status ?? current.status) as LeadStatus;
    let contactedAt = current.contacted_at;
    let contactCount = current.contact_count ?? 0;
    let nextFollowUpAt = input.nextFollowUpAt === undefined ? current.next_follow_up_at : input.nextFollowUpAt;

    if (input.recordContact) {
      contactCount += 1;
      contactedAt ??= new Date().toISOString();
      status = input.status ?? (current.status === "new" ? "contacted" : "follow_up");
    }
    if (CLOSES_FOLLOW_UP.includes(status)) nextFollowUpAt = null;
    if (status === "new") {
      contactedAt = null;
      contactCount = 0;
      nextFollowUpAt = null;
    }

    const update = {
      status,
      contacted_at: contactedAt,
      contact_count: contactCount,
      next_follow_up_at: nextFollowUpAt,
      notes: input.notes === undefined ? current.notes : input.notes,
      last_activity_at: new Date().toISOString(),
      ...(input.phone !== undefined
        ? { phone_normalized: normalizePhoneSearch(input.phone) }
        : {}),
    };
    const { data, error } = await supabase
      .from("lead_records")
      .update(update)
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .select("id,place_id,lead_type,status,contacted_at,next_follow_up_at,contact_count,notes,source_province,source_sector,created_at")
      .single();
    if (error) throw error;

    const { error: activityError } = await supabase.from("lead_activities").insert({
      user_id: user.id,
      lead_record_id: current.id,
      activity_type: activityType(status, input.recordContact, input.notes !== undefined),
      from_status: current.status,
      to_status: status,
      note: input.notes === undefined ? null : input.notes,
    });
    if (activityError) throw activityError;
    return Response.json({ record: data });
  } catch (error) {
    return apiError(error);
  }
}

function activityType(status: LeadStatus, recordContact: boolean, hasNote: boolean) {
  if (status === "replied") return "reply";
  if (recordContact) return status === "follow_up" ? "follow_up" : "message";
  if (status === "demo_sent") return "demo";
  if (status === "customer") return "customer";
  if (status === "opted_out") return "opt_out";
  if (hasNote) return "note";
  return "status";
}
