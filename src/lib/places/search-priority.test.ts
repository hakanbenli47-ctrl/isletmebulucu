import { describe, expect, it } from "vitest";
import { buildSearchPriorities } from "./search-priority";

const provinces = ["İstanbul", "Ankara", "Kırşehir"];
const sectors = ["Oto detaylandırma", "Kuaför", "Tente"];

describe("başarılı şehir ve sektör önceliği", () => {
  it("geçmiş sinyal yoksa açık veride sonuç verme ihtimali yüksek sektörden başlar", () => {
    const priorities = buildSearchPriorities(provinces, sectors, [], "website");
    expect(priorities.sectors[0]).toBe("Kuaför");
    expect(priorities.provinces).toEqual(provinces);
  });

  it("onay ve demo alınan şehir/sektör çiftini genel aramada öne taşır", () => {
    const priorities = buildSearchPriorities(provinces, sectors, [
      { lead_type: "website", status: "interested", source_province: "Kırşehir", source_sector: "Tente" },
      { lead_type: "website", status: "demo_sent", source_province: "Kırşehir", source_sector: "Tente" },
    ], "website");

    expect(priorities.provinces[0]).toBe("Kırşehir");
    expect(priorities.sectors[0]).toBe("Tente");
    expect(priorities.successfulPairs[0]).toMatchObject({ province: "Kırşehir", sector: "Tente", score: 13 });
  });

  it("başka aday türünü ve olumsuz sonucu başarı sinyali saymaz", () => {
    const priorities = buildSearchPriorities(provinces, sectors, [
      { lead_type: "accounting", status: "customer", source_province: "Kırşehir", source_sector: "Tente" },
      { lead_type: "website", status: "not_approved", source_province: "Kırşehir", source_sector: "Tente" },
    ], "website");

    expect(priorities.provinces).toEqual(provinces);
    expect(priorities.sectors[0]).toBe("Kuaför");
    expect(priorities.successfulPairs).toEqual([]);
  });
});
