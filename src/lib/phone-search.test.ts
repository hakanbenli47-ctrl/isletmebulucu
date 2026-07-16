import { describe, expect, it } from "vitest";
import {
  formatPhoneSearch,
  normalizePhoneSearch,
  phoneMatchesSearch,
} from "./phone-search";

describe("telefonla satış kaydı arama", () => {
  it("yaygın Türkiye telefon yazımlarını aynı numaraya dönüştürür", () => {
    expect(normalizePhoneSearch("0532 444 18 07")).toBe("905324441807");
    expect(normalizePhoneSearch("+90 (532) 444 18 07")).toBe("905324441807");
    expect(normalizePhoneSearch("0090 532 444 18 07")).toBe("905324441807");
  });

  it("farklı yazılan aynı numarayı eşleştirir", () => {
    expect(phoneMatchesSearch("0532 444 18 07", "+90 532 444 18 07")).toBe(true);
    expect(phoneMatchesSearch("0532 444 18 07", "0541 285 33 22")).toBe(false);
  });

  it("eksik ve geçersiz numaraları aramaya kabul etmez", () => {
    expect(normalizePhoneSearch("532 44")).toBeNull();
    expect(phoneMatchesSearch("532 44", "+90 532 444 18 07")).toBe(false);
  });

  it("arama sonucunda numarayı okunabilir gösterir", () => {
    expect(formatPhoneSearch("905324441807")).toBe("0532 444 18 07");
  });
});
