import { describe, expect, it } from "vitest";
import type { PlaceDetails } from "@/types";
import { assessSectorRelevance } from "./relevance";

function place(name: string, primaryType: string): PlaceDetails {
  return { placeId: "x", name, address: "İstanbul", province: "İstanbul", phone: "05321234567", internationalPhone: "+905321234567", websiteUri: null, mapUri: "https://www.openstreetmap.org", businessStatus: "OPERATIONAL", primaryType, rating: 4.5, userRatingCount: 20 };
}

describe("sektör eşleşmesi", () => {
  it("seçilen muhasebe sektörüne uyan işletmeyi kabul eder", () => {
    expect(assessSectorRelevance(place("Marmara Ambalaj", "packaging_supply_store"), "Ambalaj malzemeleri toptancısı", "accounting").eligible).toBe(true);
  });

  it("alakasız işletmeyi keskin filtrede reddeder", () => {
    expect(assessSectorRelevance(place("Mutlu Kuaför", "hair_salon"), "Gıda toptancısı", "accounting").eligible).toBe(false);
  });

  it("web sitesi sektörünü işletme türünden doğrular", () => {
    expect(assessSectorRelevance(place("ABC Hizmetleri", "plumber"), "Tesisatçı", "website").eligible).toBe(true);
  });

  it("kategori etiketi nesne geldiğinde çalışma zamanı hatası üretmez", () => {
    const candidate = place("Marmara Ambalaj", "supplier");
    (candidate as unknown as { typeLabel: unknown }).typeLabel = { text: "Ambalaj malzemeleri toptancısı", languageCode: "tr" };
    (candidate as unknown as { types: unknown[] }).types = ["supplier", { unexpected: true }];
    expect(() => assessSectorRelevance(candidate, "Ambalaj malzemeleri toptancısı", "accounting")).not.toThrow();
  });
});
