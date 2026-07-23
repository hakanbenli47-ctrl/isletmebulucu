import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { OverturePlaceRow } from "./mapper";

type OvertureData = {
  release: string;
  places: OverturePlaceRow[];
};

const data = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/data/overture-places.json"), "utf8"),
) as OvertureData;

describe("Overture Türkiye işletme dizini", () => {
  it("yalnızca geçerli Türkiye mobil numaraları içerir", () => {
    expect(data.release).toBe("2026-06-17.0");
    expect(data.places.length).toBeGreaterThan(30_000);
    expect(data.places.every((row) => /^\+905\d{9}$/.test(row[4]))).toBe(true);
  });

  it("İstanbul'da her aktif web sektörü için en az 50 aday sağlar", () => {
    const counts = new Map<string, number>();
    for (const row of data.places) {
      if (row[3] !== "İstanbul") continue;
      counts.set(row[11], (counts.get(row[11]) ?? 0) + 1);
    }

    for (const sector of [
      "Kuaför",
      "Güzellik merkezi",
      "Berber",
      "Nakliyat",
      "Oto yıkama",
      "Halı yıkama",
      "Tırnak salonu",
    ]) {
      expect(counts.get(sector), sector).toBeGreaterThanOrEqual(50);
    }
  });
});
