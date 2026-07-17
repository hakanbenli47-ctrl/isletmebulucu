import { describe, expect, it } from "vitest";
import { contactFromOsmTags, isWhatsAppLink } from "./contact";

describe("OpenStreetMap telefon ve WhatsApp sinyali", () => {
  it("açık WhatsApp etiketindeki numarayı diğer telefona tercih eder", () => {
    expect(contactFromOsmTags({
      "contact:mobile": "+90 541 222 33 44",
      "contact:whatsapp": "+90 532 123 45 67",
    })).toMatchObject({
      mobile: "905321234567",
      rawPhone: "+905321234567",
      whatsappEvidence: "explicit_tag",
    });
  });

  it("WhatsApp bağlantısından numarayı bulur", () => {
    expect(contactFromOsmTags({
      website: "https://wa.me/905321234567?text=Merhaba",
    })).toMatchObject({
      mobile: "905321234567",
      whatsappEvidence: "explicit_link",
    });
  });

  it("whatsapp=yes ile geçerli mobil etiketi birlikteyse açık sinyal sayar", () => {
    expect(contactFromOsmTags({
      whatsapp: "yes",
      phone: "0532 123 45 67",
    }).whatsappEvidence).toBe("explicit_tag");
  });

  it("yalnız mobil numarayı WhatsApp varmış gibi göstermeyip canlı kontrole bırakır", () => {
    expect(contactFromOsmTags({ phone: "0532 123 45 67" })).toMatchObject({
      mobile: "905321234567",
      whatsappEvidence: "mobile_only",
    });
  });

  it("whatsapp=no etiketini olumlu kanıt saymaz", () => {
    expect(contactFromOsmTags({ whatsapp: "no", mobile: "0532 123 45 67" }).whatsappEvidence).toBe("mobile_only");
  });

  it("yaygın WhatsApp bağlantılarını tanır", () => {
    expect(isWhatsAppLink("https://api.whatsapp.com/send?phone=905321234567")).toBe(true);
    expect(isWhatsAppLink("whatsapp://send?phone=905321234567")).toBe(true);
    expect(isWhatsAppLink("https://ornek.com")).toBe(false);
  });
});
