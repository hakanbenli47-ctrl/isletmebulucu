import { describe, expect, it } from "vitest";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "../../data/sectors";
import { SECTOR_SELECTORS, sectorQueryPlan, selectorsForSector } from "./sector-selectors";

describe("OpenStreetMap sektör kataloğu", () => {
  it("uygulamadaki bütün sektörleri ayrı sorgu tanımıyla kapsar", () => {
    const expected = [...WEBSITE_SECTORS, ...ACCOUNTING_SECTORS];
    expect(Object.keys(SECTOR_SELECTORS).sort()).toEqual([...expected].sort());
    for (const sector of expected) {
      expect(selectorsForSector(sector).length, sector).toBeGreaterThan(0);
    }
  });

  it("bilinmeyen sektör için işletme adı yedeği üretir", () => {
    expect(selectorsForSector("Örnek sektör")[0]).toContain('["name"~');
  });

  it("yapısal etiketi hızlı Overpass, ad yedeğini metin araması olarak ayırır", () => {
    expect(sectorQueryPlan("Halı yıkama")).toEqual({
      overpassSelectors: ['["shop"="laundry"]'],
      useTextSearch: true,
    });
    expect(sectorQueryPlan("Kuaför")).toEqual({
      overpassSelectors: ['["shop"="hairdresser"]'],
      useTextSearch: false,
    });
  });
});
