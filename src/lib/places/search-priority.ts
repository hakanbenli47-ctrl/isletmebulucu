import type { LeadStatus, LeadType } from "@/types";

export interface SearchHistorySignal {
  lead_type: LeadType | string;
  status: LeadStatus | string;
  source_province: string | null;
  source_sector: string | null;
}

export interface PrioritySearchPair {
  province: string;
  sector: string;
  score: number;
}

const SUCCESS_WEIGHTS: Partial<Record<LeadStatus, number>> = {
  interested: 5,
  demo_sent: 8,
  customer: 12,
};

// Şehir seçilmeden tek sektör arandığında ilk sorguların sonuçsuz küçük illere
// yığılmasını önler. Diğer bütün iller özgün sıralarıyla listenin devamında kalır.
const PROVINCE_BASE_PRIORITY = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Kocaeli", "Konya",
  "Adana", "Gaziantep", "Mersin", "Kayseri", "Manisa", "Tekirdağ", "Samsun",
  "Denizli", "Sakarya", "Balıkesir", "Eskişehir", "Muğla", "Hatay",
] as const;

// Açık veride yapısal OSM etiketi ve telefon kaydı daha sık bulunan sektörler önce
// denenir. Listedeki diğer tüm aktif sektörler de sıralamanın devamında korunur.
const WEBSITE_BASE_PRIORITY = [
  "Kuaför",
  "Güzellik merkezi",
  "Berber",
  "Tırnak salonu",
  "Oto yıkama",
  "Halı yıkama",
  "Nakliyat",
] as const;

const ACCOUNTING_BASE_PRIORITY = [
  "Hırdavat toptancısı",
  "Oto yedek parça toptancısı",
  "Yapı malzemeleri toptancısı",
  "Mobilya üreticisi",
  "Kırtasiye toptancısı",
  "Medikal malzeme tedarikçisi",
  "Gıda toptancısı",
  "İçecek toptancısı",
  "Yem bayisi",
  "Tarım ürünleri toptancısı",
  "Toptancı",
  "Dağıtım firması",
] as const;

export function buildSearchPriorities(
  provinces: readonly string[],
  sectors: readonly string[],
  history: readonly SearchHistorySignal[],
  leadType: LeadType,
) {
  const provinceSet = new Set(provinces);
  const sectorSet = new Set(sectors);
  const provinceScores = new Map<string, number>();
  const sectorScores = new Map<string, number>();
  const pairScores = new Map<string, PrioritySearchPair>();

  for (const row of history) {
    if (row.lead_type !== leadType) continue;
    const weight = SUCCESS_WEIGHTS[row.status as LeadStatus] ?? 0;
    if (!weight) continue;

    const province = row.source_province;
    const sector = row.source_sector;
    if (province && provinceSet.has(province)) {
      provinceScores.set(province, (provinceScores.get(province) ?? 0) + weight);
    }
    if (sector && sectorSet.has(sector)) {
      sectorScores.set(sector, (sectorScores.get(sector) ?? 0) + weight);
    }
    if (province && sector && provinceSet.has(province) && sectorSet.has(sector)) {
      const key = pairKey(province, sector);
      const current = pairScores.get(key);
      pairScores.set(key, { province, sector, score: (current?.score ?? 0) + weight });
    }
  }

  const baseSectorOrder = leadType === "website" ? WEBSITE_BASE_PRIORITY : ACCOUNTING_BASE_PRIORITY;
  return {
    provinces: rankValues(provinces, provinceScores, PROVINCE_BASE_PRIORITY),
    sectors: rankValues(sectors, sectorScores, baseSectorOrder),
    successfulPairs: [...pairScores.values()].sort((a, b) =>
      b.score - a.score ||
      provinces.indexOf(a.province) - provinces.indexOf(b.province) ||
      sectors.indexOf(a.sector) - sectors.indexOf(b.sector),
    ),
  };
}

function rankValues(
  values: readonly string[],
  scores: ReadonlyMap<string, number>,
  baseOrder: readonly string[],
) {
  const originalRank = new Map(values.map((value, index) => [value, index]));
  const preferredRank = new Map(baseOrder.map((value, index) => [value, index]));
  return [...values].sort((a, b) =>
    (scores.get(b) ?? 0) - (scores.get(a) ?? 0) ||
    (preferredRank.get(a) ?? baseOrder.length + (originalRank.get(a) ?? 0)) -
      (preferredRank.get(b) ?? baseOrder.length + (originalRank.get(b) ?? 0)),
  );
}

function pairKey(province: string, sector: string) {
  return `${province}\u0000${sector}`;
}
