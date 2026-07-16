import { describe, expect, it } from "vitest";
import {
  kullaniciyaUygunSupabaseHatasi,
  supabaseHatasiMi,
  supabaseSutunuEksikMi,
} from "./errors";

describe("Supabase hata yardımcıları", () => {
  const eksikTelefonSutunu = {
    code: "42703",
    message: "column lead_records.phone_normalized does not exist",
  };

  it("PostgREST hata nesnesini tanır", () => {
    expect(supabaseHatasiMi(eksikTelefonSutunu)).toBe(true);
    expect(supabaseHatasiMi(new Error("normal hata"))).toBe(false);
    expect(supabaseHatasiMi("hata")).toBe(false);
  });

  it("eksik sütunu güvenilir biçimde ayırır", () => {
    expect(
      supabaseSutunuEksikMi(eksikTelefonSutunu, "phone_normalized"),
    ).toBe(true);
    expect(supabaseSutunuEksikMi(eksikTelefonSutunu, "status")).toBe(false);
  });

  it("şema hatasını uygulanabilir bir mesaja çevirir", () => {
    expect(kullaniciyaUygunSupabaseHatasi(eksikTelefonSutunu)).toContain(
      "20260716190000_sales_bulk_outcomes.sql",
    );
  });
});
