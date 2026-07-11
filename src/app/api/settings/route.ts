import { z } from "zod";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "@/data/sectors";
import { DEFAULT_ACCOUNTING_MESSAGE, DEFAULT_SETTINGS, DEFAULT_WEBSITE_MESSAGE } from "@/data/defaults";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { mockStore } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  resultsPerSearch: z.number().int().min(1).max(50),
  dailyContactGoal: z.number().int().min(1).max(500),
  websiteSectors: z.array(z.enum(WEBSITE_SECTORS)).min(1),
  accountingSectors: z.array(z.enum(ACCOUNTING_SECTORS)).min(1),
  websiteMessage: z.string().trim().min(1).max(5000),
  accountingMessage: z.string().trim().min(1).max(5000),
});

export async function GET() {
  try {
    const user = await requireApiUser();
    if (isMockMode()) return Response.json({ settings: mockStore.settings, defaults: DEFAULT_SETTINGS });
    const supabase = await createSupabaseServerClient();
    const [{ data: settings }, { data: templates }] = await Promise.all([
      supabase.from("app_settings").select("results_per_search,daily_contact_goal,website_sectors,accounting_sectors").eq("user_id", user.id).maybeSingle(),
      supabase.from("message_templates").select("lead_type,message").eq("user_id", user.id),
    ]);
    const webTemplate = templates?.find((item) => item.lead_type === "website")?.message;
    const accountingTemplate = templates?.find((item) => item.lead_type === "accounting")?.message;
    return Response.json({ settings: { resultsPerSearch: settings?.results_per_search ?? 50, dailyContactGoal: settings?.daily_contact_goal ?? 25, websiteSectors: settings?.website_sectors?.length ? settings.website_sectors : [...WEBSITE_SECTORS], accountingSectors: settings?.accounting_sectors?.length ? settings.accounting_sectors : [...ACCOUNTING_SECTORS], websiteMessage: webTemplate ?? DEFAULT_WEBSITE_MESSAGE, accountingMessage: accountingTemplate ?? DEFAULT_ACCOUNTING_MESSAGE }, defaults: DEFAULT_SETTINGS });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const settings = settingsSchema.parse(await request.json());
    if (isMockMode()) { mockStore.settings = structuredClone(settings); return Response.json({ settings }); }
    const supabase = await createSupabaseServerClient();
    const [settingsResult, templatesResult] = await Promise.all([
      supabase.from("app_settings").upsert({ user_id: user.id, results_per_search: settings.resultsPerSearch, daily_contact_goal: settings.dailyContactGoal, website_sectors: settings.websiteSectors, accounting_sectors: settings.accountingSectors }, { onConflict: "user_id" }),
      supabase.from("message_templates").upsert([{ user_id: user.id, lead_type: "website", message: settings.websiteMessage }, { user_id: user.id, lead_type: "accounting", message: settings.accountingMessage }], { onConflict: "user_id,lead_type" }),
    ]);
    if (settingsResult.error) throw settingsResult.error;
    if (templatesResult.error) throw templatesResult.error;
    return Response.json({ settings });
  } catch (error) { return apiError(error); }
}
