import { describe, expect, it } from "vitest";
import { balancedResultLimit, buildSearchQueue, successfulResultLimit } from "./search-queue";

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

  it("filtresiz aramayı geçerli şehir ve sektörler arasında tekrarsız oluşturur", () => {
    const queue = buildSearchQueue({
      ...base,
      position: { provinceIndex: 2, sectorIndex: 2 },
    });
    expect(queue[0]).toMatchObject({ province: "İzmir", sector: "Tente", mixGroup: "coverage" });
    expect(queue.every((item) => item.mixGroup === "coverage")).toBe(true);
    expect(new Set(queue.map((item) => `${item.province}:${item.sector}`)).size).toBe(queue.length);
    expect(queue.every((item) => base.provinces.includes(item.province) && base.sectors.includes(item.sector))).toBe(true);
  });

  it("filtresiz taramada bütün şehir-sektör çiftlerini tekrar etmeden dolaşır", () => {
    const visited = new Set<string>();
    let position = base.position;
    for (let index = 0; index < base.provinces.length * base.sectors.length; index += 1) {
      const [pair] = buildSearchQueue({ ...base, maxCalls: 1, position });
      visited.add(`${pair.province}:${pair.sector}`);
      position = pair.cursorAfter!;
    }
    expect(visited.size).toBe(base.provinces.length * base.sectors.length);
    expect(position).toEqual(base.position);
  });

  it("filtresiz aramada çağrıların yaklaşık yüzde 40'ını başarılı çiftlere ayırır", () => {
    const queue = buildSearchQueue({
      ...base,
      maxCalls: 5,
      successfulPairs: [
        { province: "İzmir", sector: "Tente", score: 12 },
        { province: "Ankara", sector: "Mobilyacı", score: 8 },
        { province: "İstanbul", sector: "Kuaför", score: 5 },
      ],
    });
    expect(queue.filter((item) => item.mixGroup === "priority")).toHaveLength(2);
    expect(queue.filter((item) => item.mixGroup === "coverage")).toHaveLength(3);
    expect(queue[0]).toMatchObject({ province: "İzmir", sector: "Tente", mixGroup: "priority" });
  });

  it("işletme hedefinde yüzde 40 öncelik sınırını hesaplar", () => {
    expect(successfulResultLimit(10, true)).toBe(4);
    expect(successfulResultLimit(25, true)).toBe(10);
    expect(successfulResultLimit(10, false)).toBe(0);
  });

  it("çok sektörlü sonuç hedefini kalan sorgulara dengeli dağıtır", () => {
    expect(balancedResultLimit(10, 8)).toBe(2);
    expect(balancedResultLimit(8, 7)).toBe(2);
    expect(balancedResultLimit(3, 5)).toBe(1);
  });
});
