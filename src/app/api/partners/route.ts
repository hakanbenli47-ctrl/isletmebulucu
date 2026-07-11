import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReferralPartner } from "@/types";

const partnerType = z.enum(["accountant", "it", "printing", "agency", "supplier", "customer", "other"]);
const partnerStatus = z.enum(["candidate", "contacted", "active", "paused"]);
const createSchema = z.object({ name: z.string().trim().min(2).max(160), partnerType, contact: z.string().trim().max(300).default(""), notes: z.string().trim().max(5000).nullable().default(null) });
const updateSchema = z.object({ id: z.string().uuid(), status: partnerStatus.optional(), contact: z.string().trim().max(300).optional(), notes: z.string().trim().max(5000).nullable().optional(), referralsCount: z.number().int().min(0).max(100000).optional(), customersCount: z.number().int().min(0).max(100000).optional(), nextFollowUpAt: z.string().datetime().nullable().optional() });
const deleteSchema = z.object({ id: z.string().uuid() });

const mockGlobal = globalThis as typeof globalThis & { __partnerMock?: ReferralPartner[] };
const mockPartners = mockGlobal.__partnerMock ??= [];

export async function GET() {
  try {
    const user = await requireApiUser();
    if (isMockMode()) return Response.json({ partners: mockPartners, stats: partnerStats(mockPartners) });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("referral_partners").select("id,name,partner_type,contact,status,notes,referrals_count,customers_count,next_follow_up_at,created_at").eq("user_id", user.id).order("status").order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ partners: data ?? [], stats: partnerStats((data ?? []) as ReferralPartner[]) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = createSchema.parse(await request.json());
    if (isMockMode()) {
      const partner: ReferralPartner = { id: crypto.randomUUID(), name: input.name, partner_type: input.partnerType, contact: input.contact, status: "candidate", notes: input.notes, referrals_count: 0, customers_count: 0, next_follow_up_at: null, created_at: new Date().toISOString() };
      mockPartners.unshift(partner); return Response.json({ partner }, { status: 201 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("referral_partners").insert({ user_id: user.id, name: input.name, partner_type: input.partnerType, contact: input.contact, notes: input.notes }).select("id,name,partner_type,contact,status,notes,referrals_count,customers_count,next_follow_up_at,created_at").single();
    if (error) throw error;
    return Response.json({ partner: data }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const input = updateSchema.parse(await request.json());
    const update = { status: input.status, contact: input.contact, notes: input.notes, referrals_count: input.referralsCount, customers_count: input.customersCount, next_follow_up_at: input.nextFollowUpAt };
    if (isMockMode()) {
      const partner = mockPartners.find((item) => item.id === input.id);
      if (!partner) return Response.json({ error: "İş ortağı bulunamadı." }, { status: 404 });
      Object.assign(partner, Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined)));
      return Response.json({ partner });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("referral_partners").update(update).eq("user_id", user.id).eq("id", input.id).select("id,name,partner_type,contact,status,notes,referrals_count,customers_count,next_follow_up_at,created_at").single();
    if (error) throw error;
    return Response.json({ partner: data });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const { id } = deleteSchema.parse(await request.json());
    if (isMockMode()) {
      const index = mockPartners.findIndex((item) => item.id === id);
      if (index >= 0) mockPartners.splice(index, 1);
      return Response.json({ ok: true });
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("referral_partners").delete().eq("user_id", user.id).eq("id", id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

function partnerStats(partners: ReferralPartner[]) {
  return { total: partners.length, active: partners.filter((item) => item.status === "active").length, referrals: partners.reduce((sum, item) => sum + item.referrals_count, 0), customers: partners.reduce((sum, item) => sum + item.customers_count, 0) };
}
