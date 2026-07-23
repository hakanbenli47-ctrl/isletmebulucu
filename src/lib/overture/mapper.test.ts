import { describe, expect, it } from "vitest";
import { mapOverturePlace, type OverturePlaceRow } from "./mapper";

describe("mapOverturePlace", () => {
  it("telefonlu açık veri kaydını hızlı arama sonucuna dönüştürür", () => {
    const row: OverturePlaceRow = [
      "test-id",
      "Örnek Kuaför",
      "Kadıköy, İstanbul",
      "İstanbul",
      "+905321234567",
      "https://instagram.com/ornek",
      41.01,
      29.02,
      "hair_salon",
      "hair_salon",
      "2026-06-17T00:00:00Z",
      "Kuaför",
    ];

    const place = mapOverturePlace(row, {
      release: "2026-06-17.0",
      generatedAt: "2026-07-23T00:00:00Z",
    });

    expect(place).toMatchObject({
      placeId: "overture:test-id",
      province: "İstanbul",
      internationalPhone: "+905321234567",
      primaryType: "hair_salon",
      dataSource: "overture",
      businessStatus: "OPERATIONAL",
      activityConfidence: "likely",
    });
    expect(place.mapUri).toContain("mlat=41.01");
  });
});
