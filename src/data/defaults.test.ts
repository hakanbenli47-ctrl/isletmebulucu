import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE, DEFAULT_ACCOUNTING_MESSAGE, DEFAULT_WEBSITE_MESSAGE, FIRST_CONTACT_MESSAGE } from "./defaults";

describe("sıralı mesaj varsayılanları", () => {
  it("ilk temasta yalnızca kısa selam kullanır", () => {
    expect(FIRST_CONTACT_MESSAGE).toBe("Merhaba, iyi çalışmalar.");
  });

  it("ikinci mesajlarda bağlantı veya tekrar yazmama baskısı kullanmaz", () => {
    expect(DEFAULT_WEBSITE_MESSAGE).not.toMatch(/https?:\/\//);
    expect(DEFAULT_ACCOUNTING_MESSAGE).not.toMatch(/https?:\/\//);
    expect(DEFAULT_ACCOUNTING_MESSAGE).toContain("sorayım");
  });

  it("kayıt bağlantısını yalnızca ilgi sonrası detay mesajında tutar", () => {
    expect(DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE).toContain("https://www.sitemix.com.tr/on-muhasebe/kayit");
  });
});
