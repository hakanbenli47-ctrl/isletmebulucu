import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { mockStore } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/types";

const BULK_STATUSES = ["no_reply", "not_approved"] as const;
const ELIGIBLE_STATUSES: LeadStatus[] = [
  "contacted",
  "replied",
  "interested",
  "demo_sent",
  "follow_up",
];

const bodySchema = z.object({
  placeIds: z
    .array(z.string().trim().min(3).max(500))
    .min(1)
    .max(100)
    .transform((values) => [...new Set(values)]),
  status: z.enum(BULK_STATUSES),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const input = bodySchema.parse(await request.json());

    if (isMockMode()) {
      let updatedCount = 0;
      for (const record of mockStore.records) {
        if (
          input.placeIds.includes(record.place_id) &&
          ELIGIBLE_STATUSES.includes(record.status)
        ) {
          record.status = input.status;
          record.next_follow_up_at = null;
          updatedCount += 1;
        }
      }
      return Response.json({
        updatedCount,
        skippedCount: input.placeIds.length - updatedCount,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data: current, error: currentError } = await supabase
      .from("lead_records")
      .select("id,place_id,status")
      .eq("user_id", user.id)
      .in("place_id", input.placeIds)
      .in("status", ELIGIBLE_STATUSES);
    if (currentError) throw currentError;

    if (!current?.length) {
      return Response.json({ updatedCount: 0, skippedCount: input.placeIds.length });
    }

    const now = new Date().toISOString();
    const recordIds = current.map((record) => record.id);
    const { error } = await supabase
      .from("lead_records")
      .update({
        status: input.status,
        next_follow_up_at: null,
        last_activity_at: now,
      })
      .eq("user_id", user.id)
      .in("id", recordIds);
    if (error) throw error;

    const { error: activityError } = await supabase
      .from("lead_activities")
      .insert(
        current.map((record) => ({
          user_id: user.id,
          lead_record_id: record.id,
          activity_type: "status",
          from_status: record.status,
          to_status: input.status,
          note: null,
        })),
      );
    if (activityError) throw activityError;

    return Response.json({
      updatedCount: current.length,
      skippedCount: input.placeIds.length - current.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
