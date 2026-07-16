import { describe, expect, it } from "vitest";
import { buildWhatsAppDesktopUrl, buildWhatsAppUrl, buildWhatsAppWebUrl, formatTurkishMobilePhone, normalizeTurkishPhone, personalizeWhatsAppMessage } from "./index";

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

describe("formatTurkishMobilePhone", () => {
  it("cep telefonunu okunabilir yerel biçimde gösterir", () => {
    expect(formatTurkishMobilePhone("+90 532 123 45 67")).toBe("0532 123 45 67");
  });

  it("geçersiz veya sabit telefonu biçimlendirmez", () => {
    expect(formatTurkishMobilePhone("0212 123 45 67")).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("telefonu ve mesajı güvenli bağlantıya dönüştürür", () => {
    expect(buildWhatsAppUrl("0532 123 45 67", "Merhaba & iyi çalışmalar"))
      .toBe("https://wa.me/905321234567?text=Merhaba%20%26%20iyi%20%C3%A7al%C4%B1%C5%9Fmalar");
  });

  it("masaüstü uygulama bağlantısını oluşturur", () => {
    expect(buildWhatsAppDesktopUrl("0532 123 45 67", "Merhaba"))
      .toBe("whatsapp://send?phone=905321234567&text=Merhaba");
  });

  it("WhatsApp Web bağlantısını oluşturur", () => {
    expect(buildWhatsAppWebUrl("0532 123 45 67", "İyi çalışmalar"))
      .toBe("https://web.whatsapp.com/send?phone=905321234567&text=%C4%B0yi%20%C3%A7al%C4%B1%C5%9Fmalar");
  });
});

describe("personalizeWhatsAppMessage", () => {
  it("varsayılan selamlamayı işletme adıyla değiştirir", () => {
    expect(personalizeWhatsAppMessage(
      "Merhaba, iyi çalışmalar.\n\nSize web sitesi teklifimiz var.",
      "Örnek Oto Yıkama",
    )).toBe("Merhaba, Örnek Oto Yıkama yetkilisi. İyi çalışmalar.\n\nSize web sitesi teklifimiz var.");
  });

  it("özel şablona kişisel selamlama ekler", () => {
    expect(personalizeWhatsAppMessage("Size bir teklifimiz var.", "Başkent Cam Balkon"))
      .toBe("Merhaba, Başkent Cam Balkon yetkilisi. İyi çalışmalar.\n\nSize bir teklifimiz var.");
  });

  it("işletme adındaki satır sonlarını temizler", () => {
    expect(personalizeWhatsAppMessage("Teklif metni", "Örnek\n  İşletme"))
      .toContain("Merhaba, Örnek İşletme yetkilisi.");
  });
});
