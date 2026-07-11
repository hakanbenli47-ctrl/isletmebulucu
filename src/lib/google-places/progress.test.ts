import { describe, expect, it } from "vitest";
import { advanceSearchPosition } from "./progress";

describe("advanceSearchPosition", () => {
  it("önce sektörü ilerletir", () => {
    expect(advanceSearchPosition({ provinceIndex: 3, sectorIndex: 1 }, 81, 4)).toEqual({ provinceIndex: 3, sectorIndex: 2 });
  });
  it("son sektörden sonra şehre geçer", () => {
    expect(advanceSearchPosition({ provinceIndex: 3, sectorIndex: 3 }, 81, 4)).toEqual({ provinceIndex: 4, sectorIndex: 0 });
  });
  it("81 il tamamlanınca başa döner", () => {
    expect(advanceSearchPosition({ provinceIndex: 80, sectorIndex: 3 }, 81, 4)).toEqual({ provinceIndex: 0, sectorIndex: 0 });
  });
});
