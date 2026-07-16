interface SupabaseHatasi {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
}

export function supabaseHatasiMi(error: unknown): error is SupabaseHatasi {
  return Boolean(
    error &&
      typeof error === "object" &&
      typeof (error as SupabaseHatasi).code === "string" &&
      typeof (error as SupabaseHatasi).message === "string",
  );
}

export function supabaseSutunuEksikMi(error: unknown, sutun: string) {
  if (!supabaseHatasiMi(error)) return false;
  const kod = String(error.code ?? "");
  const mesaj = String(error.message ?? "").toLocaleLowerCase("tr-TR");
  const aranan = sutun.toLocaleLowerCase("tr-TR");

  return (
    (kod === "42703" || kod === "PGRST204") &&
    mesaj.includes(aranan) &&
    (mesaj.includes("does not exist") ||
      mesaj.includes("could not find") ||
      mesaj.includes("bulunamad"))
  );
}

export function kullaniciyaUygunSupabaseHatasi(error: unknown) {
  if (!supabaseHatasiMi(error)) return null;
  const kod = String(error.code ?? "");
  const mesaj = String(error.message ?? "");

  if (
    supabaseSutunuEksikMi(error, "phone_normalized") ||
    (kod === "23514" && mesaj.includes("lead_records_status_check"))
  ) {
    return "Veritabanı güncellemesi eksik. Supabase SQL Editor içinde supabase/migrations/20260716190000_sales_bulk_outcomes.sql dosyasını çalıştırın.";
  }

  if (kod === "42501") {
    return "Veritabanı bu işlem için yetki vermedi. Oturumunuzu ve Supabase RLS ayarlarını kontrol edin.";
  }

  return "Veritabanı işlemi tamamlanamadı. Lütfen tekrar deneyin; sorun sürerse sunucu kayıtlarını kontrol edin.";
}
