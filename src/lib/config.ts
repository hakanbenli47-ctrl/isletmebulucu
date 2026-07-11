export const isMockMode = () => process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
