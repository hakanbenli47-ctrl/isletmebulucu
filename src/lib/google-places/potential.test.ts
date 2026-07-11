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
    expect(assessPotential(place({ rating: 4.7, userRatingCount: 42 }), "website").level).toBe("high");
  });

  it("ön muhasebede stok ve cari yoğun sektörü önceliklendirir", () => {
    const result = assessPotential(place({ rating: 4.5, userRatingCount: 80, sector: "Yapı malzemeleri" }), "accounting");
    expect(result).toMatchObject({ eligible: true, level: "high" });
  });

  it("öncelikli adayları ve ideal yorum aralığını önce sıralar", () => {
    const ordered = orderPotentialPlaces([
      place({ placeId: "çok-yorum", rating: 4.8, userRatingCount: 220 }),
      place({ placeId: "öncelikli", rating: 4.6, userRatingCount: 35 }),
      place({ placeId: "standart", rating: 4.2, userRatingCount: 20 }),
    ], "website");
    expect(ordered.map((item) => item.placeId)).toEqual(["öncelikli", "standart", "çok-yorum"]);
  });
});
