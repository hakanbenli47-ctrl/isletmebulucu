import { describe, expect, it } from "vitest";
import { isOpenedWithinLastTwoYears, openingRecencyStatus, parseConservativeOpeningDate } from "./activity";

describe("işletme açılış tarihi filtresi", () => {
  const now = new Date("2026-07-17T12:00:00Z");

  it("son iki yılda açılan kesin tarihli işletmeyi kabul eder", () => {
    expect(isOpenedWithinLastTwoYears("2025-03-10", now)).toBe(true);
    expect(isOpenedWithinLastTwoYears("2025", now)).toBe(true);
  });

  it("iki yıldan eski veya tarihi belirsiz işletmeyi reddeder", () => {
    expect(isOpenedWithinLastTwoYears("2023-12-31", now)).toBe(false);
    expect(isOpenedWithinLastTwoYears("2024", now)).toBe(false);
    expect(isOpenedWithinLastTwoYears("yakın zamanda", now)).toBe(false);
  });

  it("OpenStreetMap yaklaşık tarih işaretini okuyabilir", () => {
    expect(parseConservativeOpeningDate("~2025-06")?.toISOString()).toContain("2025-06-01");
  });

  it("kayıtlı olmayan tarih ile açıkça eski tarihi birbirinden ayırır", () => {
    expect(openingRecencyStatus(undefined, now)).toBe("unknown");
    expect(openingRecencyStatus("yakın zamanda", now)).toBe("unknown");
    expect(openingRecencyStatus("2023-12-31", now)).toBe("old");
    expect(openingRecencyStatus("2025-03-10", now)).toBe("recent");
  });
});
