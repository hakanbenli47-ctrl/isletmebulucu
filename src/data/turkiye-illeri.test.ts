import { describe, expect, it } from "vitest";
import { TURKIYE_ILLERI, TURKIYE_IL_ISO_KODLARI } from "./turkiye-illeri";

describe("Türkiye il tarama sırası", () => {
  it("81 benzersiz ili içerir", () => {
    expect(TURKIYE_ILLERI).toHaveLength(81);
    expect(new Set(TURKIYE_ILLERI).size).toBe(81);
  });

  it("ticari merkezlerden başlar", () => {
    expect(TURKIYE_ILLERI.slice(0, 6)).toEqual(["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Kocaeli"]);
  });

  it("her ili benzersiz ve doğru biçimli bir OSM ISO koduna bağlar", () => {
    const codes = TURKIYE_ILLERI.map((province) => TURKIYE_IL_ISO_KODLARI[province]);
    expect(codes).toHaveLength(81);
    expect(new Set(codes).size).toBe(81);
    expect(codes.every((code) => /^TR-\d{2}$/.test(code))).toBe(true);
    expect(TURKIYE_IL_ISO_KODLARI.İstanbul).toBe("TR-34");
    expect(TURKIYE_IL_ISO_KODLARI.Hakkâri).toBe("TR-30");
  });
});
