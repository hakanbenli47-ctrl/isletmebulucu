import { describe, expect, it } from "vitest";
import type { PlaceDetails } from "@/types";
import { assessSectorRelevance } from "./relevance";

function place(name: string, primaryType: string): PlaceDetails {
  return { placeId: "x", name, address: "İstanbul", province: "İstanbul", phone: "05321234567", internationalPhone: "+905321234567", websiteUri: null, googleMapsUri: "https://maps.google.com", businessStatus: "OPERATIONAL", primaryType, rating: 4.5, userRatingCount: 20 };
}

describe("sektör eşleşmesi", () => {
  it("seçilen muhasebe sektörüne uyan işletmeyi kabul eder", () => {
    expect(assessSectorRelevance(place("Marmara Ambalaj", "packaging_supply_store"), "Ambalaj malzemeleri toptancısı", "accounting").eligible).toBe(true);
  });

  it("alakasız işletmeyi keskin filtrede reddeder", () => {
    expect(assessSectorRelevance(place("Mutlu Kuaför", "hair_salon"), "Gıda toptancısı", "accounting").eligible).toBe(false);
  });

  it("web sitesi sektörünü Google türünden doğrular", () => {
    expect(assessSectorRelevance(place("ABC Hizmetleri", "plumber"), "Tesisatçı", "website").eligible).toBe(true);
  });
});
