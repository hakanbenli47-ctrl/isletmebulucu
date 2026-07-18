import { advanceSearchPosition, type SearchPosition } from "./progress";
import type { PrioritySearchPair } from "./search-priority";

export const SUCCESSFUL_RESULT_SHARE = 0.4;

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
  mixGroup?: "priority" | "coverage";
}

export function buildSearchQueue(options: SearchQueueOptions): QueuedSearchPair[] {
  const pairs: QueuedSearchPair[] = [];
  const used = new Set<string>();
  const add = (
    province: string,
    sector: string,
    cursorAfter?: SearchPosition,
    mixGroup?: QueuedSearchPair["mixGroup"],
  ) => {
    if (pairs.length >= options.maxCalls) return;
    const key = pairKey(province, sector);
    if (used.has(key)) return;
    used.add(key);
    pairs.push({ province, sector, cursorAfter, ...(mixGroup ? { mixGroup } : {}) });
  };

  if (options.requestedProvince && options.requestedSector) {
    add(options.requestedProvince, options.requestedSector);
    return pairs;
  }

  const matchingSuccesses = options.successfulPairs.filter((pair) =>
    (!options.requestedProvince || pair.province === options.requestedProvince) &&
    (!options.requestedSector || pair.sector === options.requestedSector),
  );
  if (options.requestedProvince || options.requestedSector) {
    for (const pair of matchingSuccesses.slice(0, 1)) {
      add(pair.province, pair.sector);
    }
  }

  // Tek boyutlu filtrelerde hızlı sonuç veren eşleşmeyle başlarız; filtresiz
  // arama ise aşağıda bütün şehir-sektör çiftlerini kapsayan sırayla oluşturulur.
  if (!matchingSuccesses.length && (options.requestedProvince || options.requestedSector)) {
    add(
      options.requestedProvince ?? options.provinces[0],
      options.requestedSector ?? options.sectors[0],
    );
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

  const priorityCallCount = Math.min(
    options.successfulPairs.length,
    Math.max(1, Math.round(options.maxCalls * SUCCESSFUL_RESULT_SHARE)),
  );
  for (const pair of options.successfulPairs.slice(0, priorityCallCount)) {
    add(pair.province, pair.sector, undefined, "priority");
  }

  addCoverageSearchPairs(options, pairs);
  return pairs;
}

export function successfulResultLimit(target: number, hasSuccessfulPairs: boolean) {
  return hasSuccessfulPairs ? Math.max(1, Math.round(target * SUCCESSFUL_RESULT_SHARE)) : 0;
}

export function balancedResultLimit(remaining: number, callsRemaining: number) {
  return Math.min(remaining, Math.max(1, Math.ceil(remaining / Math.max(1, callsRemaining))));
}

function addCoverageSearchPairs(options: SearchQueueOptions, pairs: QueuedSearchPair[]) {
  const used = new Set(pairs.map((pair) => pairKey(pair.province, pair.sector)));
  let cursor = {
    provinceIndex: modulo(options.position.provinceIndex, options.provinces.length),
    sectorIndex: modulo(options.position.sectorIndex, options.sectors.length),
  };
  const totalPairs = options.provinces.length * options.sectors.length;

  // Karışık görünen fakat bütün kombinasyonları tekrarsız dolaşan adım kullanılır.
  // Böylece kuaför gibi yoğun bir sektör diğer aktif sektörlerin sırasını kapatamaz.
  for (let attempts = 0; attempts < totalPairs && pairs.length < options.maxCalls; attempts += 1) {
    const province = options.provinces[cursor.provinceIndex];
    const sector = options.sectors[cursor.sectorIndex];
    const cursorAfter = advanceSearchPosition(cursor, options.provinces.length, options.sectors.length);
    const key = pairKey(province, sector);
    if (!used.has(key)) {
      used.add(key);
      pairs.push({ province, sector, cursorAfter, mixGroup: "coverage" });
    }
    cursor = cursorAfter;
  }
}

function pairKey(province: string, sector: string) {
  return `${province}\u0000${sector}`;
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
