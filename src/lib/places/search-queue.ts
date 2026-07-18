import { advanceSearchPosition, type SearchPosition } from "./progress";
import type { PrioritySearchPair } from "./search-priority";

export interface SearchQueueOptions {
  requestedProvince?: string;
  requestedSector?: string;
  provinces: string[];
  sectors: string[];
  successfulPairs: PrioritySearchPair[];
  position: SearchPosition;
  maxCalls: number;
}

export interface QueuedSearchPair {
  province: string;
  sector: string;
  cursorAfter?: SearchPosition;
}

export function buildSearchQueue(options: SearchQueueOptions): QueuedSearchPair[] {
  const pairs: QueuedSearchPair[] = [];
  const add = (province: string, sector: string, cursorAfter?: SearchPosition) => {
    if (pairs.length >= options.maxCalls) return;
    pairs.push({ province, sector, cursorAfter });
  };

  if (options.requestedProvince && options.requestedSector) {
    add(options.requestedProvince, options.requestedSector);
    return pairs;
  }

  const matchingSuccesses = options.successfulPairs.filter((pair) =>
    (!options.requestedProvince || pair.province === options.requestedProvince) &&
    (!options.requestedSector || pair.sector === options.requestedSector),
  );
  for (const pair of matchingSuccesses.slice(0, options.requestedProvince || options.requestedSector ? 1 : 2)) {
    add(pair.province, pair.sector);
  }

  if (options.requestedProvince) {
    let sectorIndex = modulo(options.position.sectorIndex, options.sectors.length);
    for (let attempts = 0; attempts < options.sectors.length && pairs.length < options.maxCalls; attempts += 1) {
      const currentSectorIndex = sectorIndex;
      sectorIndex = (sectorIndex + 1) % options.sectors.length;
      add(options.requestedProvince, options.sectors[currentSectorIndex], {
        ...options.position,
        sectorIndex,
      });
    }
    return pairs;
  }

  if (options.requestedSector) {
    let provinceIndex = modulo(options.position.provinceIndex, options.provinces.length);
    for (let attempts = 0; attempts < options.provinces.length && pairs.length < options.maxCalls; attempts += 1) {
      const currentProvinceIndex = provinceIndex;
      provinceIndex = (provinceIndex + 1) % options.provinces.length;
      add(options.provinces[currentProvinceIndex], options.requestedSector, {
        ...options.position,
        provinceIndex,
      });
    }
    return pairs;
  }

  const totalPairs = options.provinces.length * options.sectors.length;
  let cursor = { ...options.position };
  for (let attempts = 0; attempts < totalPairs && pairs.length < options.maxCalls; attempts += 1) {
    const cursorAfter = advanceSearchPosition(cursor, options.provinces.length, options.sectors.length);
    add(
      options.provinces[cursor.provinceIndex],
      options.sectors[cursor.sectorIndex],
      cursorAfter,
    );
    cursor = cursorAfter;
  }
  return pairs;
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
