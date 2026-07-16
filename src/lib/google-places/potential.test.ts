import { describe, expect, it } from "vitest";
import type { PlaceDetails } from "@/types";
import { assessPotential, orderPotentialPlaces } from "./potential";

function place(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    placeId: "test-place",
    name: "Test İşletme",
    address: "Test adresi",
    province: "İstanbul",
    phone: "05321234567",
    internationalPhone: "+905321234567",
    websiteUri: null,
    googleMapsUri: "https://maps.google.com",
    businessStatus: "OPERATIONAL",
    primaryType: "store",
    rating: 4.4,
    userRatingCount: 30,
    ...overrides,
  };
}

describe("potansiyel aday kuralları", () => {
  it("web sitesi adayı için puan ve yorum alt sınırını uygular", () => {
    expect(assessPotential(place({ rating: 3.9 }), "website").eligible).toBe(false);
    expect(assessPotential(place({ userRatingCount: 4 }), "website").eligible).toBe(false);
    expect(assessPotential(place({ rating: 4.2, userRatingCount: 25 }), "website").eligible).toBe(true);
  });

  it("güçlü yerel web sitesi adayını öncelikli işaretler", () => {
    const result = assessPotential(place({ rating: 4.7, userRatingCount: 42 }), "website");
    expect(result.level).toBe("high");
    expect(result.score).toBe(85);
  });

  it("ön muhasebede stok ve cari yoğun sektörü önceliklendirir", () => {
    const result = assessPotential(place({ rating: 4.5, userRatingCount: 80, sector: "Yapı malzemeleri toptancısı" }), "accounting");
    expect(result).toMatchObject({ eligible: true, level: "high" });
  });

  it("az yorumlu B2B toptancıyı dengeli modda kaçırmaz", () => {
    const result = assessPotential(place({ rating: 4.1, userRatingCount: 3, sector: "Gıda toptancısı" }), "accounting");
    expect(result).toMatchObject({ eligible: true, level: "high" });
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("seçici ve geniş kalite eşiklerini ayrı uygular", () => {
    const candidate = place({ rating: 3.9, userRatingCount: 3 });
    expect(assessPotential(candidate, "website", "selective").eligible).toBe(false);
    expect(assessPotential(candidate, "website", "broad").eligible).toBe(true);
  });

  it("sabit telefonlu işletmeyi puanı yüksek olsa da aday saymaz", () => {
    const result = assessPotential(place({ phone: "0212 123 45 67", internationalPhone: "+90 212 123 45 67", rating: 4.9, userRatingCount: 40 }), "website");
    expect(result.eligible).toBe(false);
  });

  it("öncelikli adayları ve ideal yorum aralığını önce sıralar", () => {
    const ordered = orderPotentialPlaces([
      place({ placeId: "çok-yorum", rating: 4.8, userRatingCount: 220 }),
      place({ placeId: "öncelikli", rating: 4.6, userRatingCount: 35 }),
      place({ placeId: "standart", rating: 4.2, userRatingCount: 20 }),
    ], "website");
    expect(ordered.map((item) => item.placeId)).toEqual(["öncelikli", "standart", "çok-yorum"]);
  });

  it("yakın zamanda paylaşım yapan Instagram adayına etkinlik puanı verir", () => {
    const active = assessPotential(place({ websiteUri: "https://instagram.com/ornek", instagramActivity: "active" }), "website");
    const inactive = assessPotential(place({ websiteUri: "https://instagram.com/ornek", instagramActivity: "inactive" }), "website");
    expect(active.score).toBeGreaterThan(inactive.score);
  });
});
