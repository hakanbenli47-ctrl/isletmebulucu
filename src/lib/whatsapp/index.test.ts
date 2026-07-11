import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, normalizeTurkishPhone } from "./index";

describe("normalizeTurkishPhone", () => {
  it.each([
    ["0532 123 45 67", "905321234567"],
    ["+90 (532) 123-45-67", "905321234567"],
    ["5321234567", "905321234567"],
    ["0090 532 123 45 67", "905321234567"],
  ])("%s numarasını normalize eder", (input, expected) => {
    expect(normalizeTurkishPhone(input)).toBe(expected);
  });

  it.each(["123", "0212 123 45 67", "", null])("geçersiz numarayı reddeder", (input) => {
    expect(normalizeTurkishPhone(input)).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("telefonu ve mesajı güvenli bağlantıya dönüştürür", () => {
    expect(buildWhatsAppUrl("0532 123 45 67", "Merhaba & iyi çalışmalar"))
      .toBe("https://wa.me/905321234567?text=Merhaba%20%26%20iyi%20%C3%A7al%C4%B1%C5%9Fmalar");
  });
});
