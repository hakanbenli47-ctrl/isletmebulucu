import "server-only";
import overtureData from "@/data/overture-places.json";
import { mapOverturePlace, type OverturePlaceRow } from "@/lib/overture/mapper";

type OvertureIndexData = {
  release: string;
  generatedAt: string;
  source: string;
  places: OverturePlaceRow[];
};

type GlobalOvertureState = typeof globalThis & {
  __overturePlacesByPair?: Map<string, OverturePlaceRow[]>;
};

const data = overtureData as OvertureIndexData;
const globalState = globalThis as GlobalOvertureState;

export const OVERTURE_RELEASE = data.release;
export const OVERTURE_PLACE_COUNT = data.places.length;

export function searchOverturePlaces(sector: string, province: string) {
  const index = globalState.__overturePlacesByPair ??= buildIndex(data.places);
  return (index.get(pairKey(province, sector)) ?? [])
    .map((row) => mapOverturePlace(row, data));
}

function buildIndex(rows: OverturePlaceRow[]) {
  const index = new Map<string, OverturePlaceRow[]>();
  for (const row of rows) {
    const key = pairKey(row[3], row[11]);
    const existing = index.get(key);
    if (existing) existing.push(row);
    else index.set(key, [row]);
  }
  return index;
}

function pairKey(province: string, sector: string) {
  return `${province}\u0000${sector}`;
}
