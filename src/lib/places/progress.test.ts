import { describe, expect, it } from "vitest";
import { advanceSearchPosition } from "./progress";

describe("advanceSearchPosition", () => {
  it("ardışık çağrılarda hem şehri hem sektörü değiştirir", () => {
    expect(advanceSearchPosition({ provinceIndex: 0, sectorIndex: 0 }, 81, 4)).toEqual({ provinceIndex: 2, sectorIndex: 1 });
  });

  it("bütün şehir-sektör çiftlerini tekrarsız dolaşıp başlangıca döner", () => {
    const provinceCount = 5;
    const sectorCount = 4;
    const visited = new Set<string>();
    let position = { provinceIndex: 0, sectorIndex: 0 };

    for (let index = 0; index < provinceCount * sectorCount; index += 1) {
      visited.add(`${position.provinceIndex}:${position.sectorIndex}`);
      position = advanceSearchPosition(position, provinceCount, sectorCount);
    }

    expect(visited.size).toBe(provinceCount * sectorCount);
    expect(position).toEqual({ provinceIndex: 0, sectorIndex: 0 });
  });
});

