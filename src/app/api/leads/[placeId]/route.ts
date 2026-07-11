import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { updateMockLead } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const placeIdSchema = z.string().trim().min(3).max(500);
const bodySchema = z.object({ status: z.enum(["new", "contacted", "not_suitable", "no_whatsapp", "customer", "archived"]) });

export async function PATCH(request: Request, context: RouteContext<"/api/leads/[placeId]">) {
  try {
    const user = await requireApiUser();
    const { placeId: rawPlaceId } = await context.params;
    const placeId = placeIdSchema.parse(decodeURIComponent(rawPlaceId));
    const { status } = bodySchema.parse(await request.json());

    if (isMockMode()) {
      const record = updateMockLead(placeId, status);
      if (!record) return Response.json({ error: "İşletme bulunamadı." }, { status: 404 });
      return Response.json({ record });
    }

    const supabase = await createSupabaseServerClient();
    const update = { status, contacted_at: status === "contacted" ? new Date().toISOString() : status === "new" ? null : undefined };
    const { data, error } = await supabase.from("lead_records").update(update).eq("user_id", user.id).eq("place_id", placeId).select("id,place_id,lead_type,status,contacted_at,created_at").single();
    if (error) throw error;
    return Response.json({ record: data });
  } catch (error) {
    return apiError(error);
  }
}
