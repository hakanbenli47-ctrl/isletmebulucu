import { describe, expect, it } from "vitest";
import { buildSearchQueue } from "./search-queue";

const base = {
  provinces: ["İstanbul", "Ankara", "İzmir"],
  sectors: ["Kuaför", "Mobilyacı", "Tente"],
  successfulPairs: [],
  position: { provinceIndex: 0, sectorIndex: 0 },
  maxCalls: 4,
};

describe("arama filtresi kuyruğu", () => {
  it("il ve sektör birlikte seçilince sadece tam eşleşmeyi arar", () => {
    const queue = buildSearchQueue({ ...base, requestedProvince: "Ankara", requestedSector: "Tente" });
    expect(queue).toEqual([{ province: "Ankara", sector: "Tente", cursorAfter: undefined }]);
  });

  it("yalnız il seçilince ili sabit tutup aktif sektörleri ilerletir", () => {
    const queue = buildSearchQueue({ ...base, requestedProvince: "Ankara" });
    expect(queue.map((item) => item.province)).toEqual(["Ankara", "Ankara", "Ankara"]);
    expect(queue.map((item) => item.sector)).toEqual(base.sectors);
  });

  it("yalnız sektör seçilince sektörü sabit tutup şehirleri ilerletir", () => {
    const queue = buildSearchQueue({ ...base, requestedSector: "Mobilyacı" });
    expect(queue.map((item) => item.sector)).toEqual(["Mobilyacı", "Mobilyacı", "Mobilyacı"]);
    expect(queue.map((item) => item.province)).toEqual(base.provinces);
  });

  it("filtresiz aramada başarılı çifti önce, farklı şehir/sektörleri ardından dener", () => {
    const queue = buildSearchQueue({
      ...base,
      successfulPairs: [{ province: "İzmir", sector: "Tente", score: 8 }],
    });
    expect(queue[0]).toMatchObject({ province: "İzmir", sector: "Tente" });
    expect(new Set(queue.slice(1).map((item) => item.province)).size).toBeGreaterThan(1);
    expect(new Set(queue.slice(1).map((item) => item.sector)).size).toBeGreaterThan(1);
  });
});
