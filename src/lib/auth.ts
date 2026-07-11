import "server-only";
import type { User } from "@supabase/supabase-js";
import { isMockMode } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthError extends Error {}

const DEMO_USER = { id: "00000000-0000-0000-0000-000000000001", email: "demo@isletmebulucu.local" } as User;

export async function getCurrentUser(): Promise<User | null> {
  if (isMockMode()) return DEMO_USER;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const allowed = process.env.ALLOWED_USER_EMAIL?.trim().toLocaleLowerCase("tr-TR");
  if (allowed && data.user.email?.toLocaleLowerCase("tr-TR") !== allowed) return null;
  return data.user;
}

export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Oturum gerekli.");
  return user;
}
