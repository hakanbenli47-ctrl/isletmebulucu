import { describe, expect, it } from "vitest";
import type { PlaceDetails } from "@/types";
import { createQualificationDiagnostics, qualifySearchResults } from "./qualification";

function place(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    placeId: "place-1",
    name: "Marmara Ambalaj",
    address: "Osmangazi/Bursa",
    province: "Bursa",
    countryCode: "TR",
    phone: "0532 123 45 67",
    internationalPhone: "+90 532 123 45 67",
    websiteUri: null,
    googleMapsUri: "https://maps.google.com",
    businessStatus: "OPERATIONAL",
    primaryType: "wholesaler",
    types: ["wholesaler", "supplier"],
    typeLabel: "Ambalaj malzemeleri toptancısı",
    rating: 4.4,
    userRatingCount: 30,
    sector: "Ambalaj malzemeleri toptancısı",
    ...overrides,
  };
}

function qualify(places: PlaceDetails[]) {
  const diagnostics = createQualificationDiagnostics();
  const accepted = qualifySearchResults(places, {
    leadType: "accounting",
    sector: "Ambalaj malzemeleri toptancısı",
    province: "Bursa",
    quality: "recommended",
    presence: "all",
    seenPlaceIds: new Set(),
    seenMobiles: new Set(),
    limit: 10,
    diagnostics,
  });
  return { accepted, diagnostics };
}

describe("Google işletme aday doğrulaması", () => {
  it("faal, doğru ilde, cep telefonlu ve sektörle eşleşen işletmeyi kabul eder", () => {
    expect(qualify([place()]).accepted).toHaveLength(1);
  });

  it("sabit telefonlu veya yanlış ildeki sonucu reddeder", () => {
    const result = qualify([
      place({ placeId: "landline", phone: "0224 123 45 67", internationalPhone: "+90 224 123 45 67" }),
      place({ placeId: "wrong-city", province: "İstanbul" }),
    ]);
    expect(result.accepted).toHaveLength(0);
    expect(result.diagnostics).toMatchObject({ invalidMobile: 1, wrongLocation: 1 });
  });

  it("aynı cep telefonuyla dönen şube tekrarını tek aday sayar", () => {
    const result = qualify([place(), place({ placeId: "place-2", name: "Marmara Ambalaj Şube" })]);
    expect(result.accepted).toHaveLength(1);
    expect(result.diagnostics.duplicateMobile).toBe(1);
  });

  it("genel toptancı türü olsa bile sektör sinyali bulunmayan işletmeyi reddeder", () => {
    const result = qualify([place({ name: "Örnek Ticaret", typeLabel: "Toptancı", types: ["wholesaler"] })]);
    expect(result.accepted).toHaveLength(0);
    expect(result.diagnostics.irrelevantSector).toBe(1);
  });
});
