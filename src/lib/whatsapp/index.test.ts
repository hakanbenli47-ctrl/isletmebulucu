import { describe, expect, it } from "vitest";
import { buildWhatsAppDesktopUrl, buildWhatsAppUrl, buildWhatsAppWebUrl, extractTurkishMobilePhones, formatTurkishMobilePhone, normalizeTurkishPhone, personalizeWhatsAppMessage } from "./index";

describe("normalizeTurkishPhone", () => {
  it.each([
    ["0532 123 45 67", "905321234567"],
    ["+90 (532) 123-45-67", "905321234567"],
    ["+90 (0) 532 123 45 67", "905321234567"],
    ["5321234567", "905321234567"],
    ["0090 532 123 45 67", "905321234567"],
  ])("%s numarasını normalize eder", (input, expected) => {
    expect(normalizeTurkishPhone(input)).toBe(expected);
  });

  it.each(["123", "0212 123 45 67", "", null])("geçersiz numarayı reddeder", (input) => {
    expect(normalizeTurkishPhone(input)).toBeNull();
  });

  it.each(["0500 123 45 67", "0512 123 45 67", "0556 123 45 67", "0570 123 45 67"])("BTK mobil abone bloğu olmayan %s numarasını reddeder", (input) => {
    expect(normalizeTurkishPhone(input)).toBeNull();
  });

  it.each(["0501 123 45 67", "0505 123 45 67", "0510 123 45 67", "0516 123 45 67", "0549 123 45 67", "0559 123 45 67", "0561 123 45 67"])("BTK planındaki %s mobil numarasını kabul eder", (input) => {
    expect(normalizeTurkishPhone(input)).not.toBeNull();
  });

  it("WhatsApp bağlantısındaki telefonu ve çoklu numaraları çıkarır", () => {
    expect(extractTurkishMobilePhones("https://wa.me/905321234567?text=Merhaba")).toEqual(["905321234567"]);
    expect(extractTurkishMobilePhones("0532 123 45 67; 0541 765 43 21")).toEqual(["905321234567", "905417654321"]);
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
