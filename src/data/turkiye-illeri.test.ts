import { describe, expect, it } from "vitest";
import { TURKIYE_ILLERI } from "./turkiye-illeri";

describe("Türkiye il tarama sırası", () => {
  it("81 benzersiz ili içerir", () => {
    expect(TURKIYE_ILLERI).toHaveLength(81);
    expect(new Set(TURKIYE_ILLERI).size).toBe(81);
  });

  it("ticari merkezlerden başlar", () => {
    expect(TURKIYE_ILLERI.slice(0, 6)).toEqual(["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Kocaeli"]);
  });
});
