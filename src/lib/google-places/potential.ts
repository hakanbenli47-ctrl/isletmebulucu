import type { LeadQuality, LeadType, PlaceDetails } from "@/types";

const ACCOUNTING_SECTOR_PRIORITY = [
  "Gıda toptancısı",
  "İçecek toptancısı",
  "Temizlik malzemeleri toptancısı",
  "Ambalaj malzemeleri toptancısı",
  "Oto yedek parça toptancısı",
  "Hırdavat toptancısı",
  "Yapı malzemeleri toptancısı",
  "Elektrik malzemeleri toptancısı",
  "Tekstil toptancısı",
  "Kırtasiye toptancısı",
  "Medikal malzeme tedarikçisi",
  "Endüstriyel malzeme tedarikçisi",
  "Tarım ürünleri toptancısı",
  "Toptancı",
  "Dağıtım firması",
  "Mobilya üreticisi",
  "Plastik ürün üreticisi",
  "Yem bayisi",
] as const;

const ACCOUNTING_PRIMARY_TYPE_PRIORITY = [
  "auto_parts_store", "hardware_store", "building_materials_store", "wholesaler",
  "distribution_service", "furniture_maker", "manufacturer", "warehouse_store",
  "medical_supply_store", "packaging_supply_store",
];

export interface PotentialAssessment {
  eligible: boolean;
  level: "high" | "standard";
  reason: string;
}

export function assessPotential(place: PlaceDetails, leadType: LeadType, quality: LeadQuality = "recommended"): PotentialAssessment {
  const rating = place.rating ?? 0;
  const reviews = place.userRatingCount;

  if (leadType === "website") {
    const eligible = quality === "selective"
      ? rating >= 4.4 && reviews >= 10 && reviews <= 150
      : quality === "broad"
        ? rating >= 3.8 && reviews >= 2 && reviews <= 500
        : rating >= 4 && reviews >= 5 && reviews <= 250;
    const high = eligible && rating >= 4.5 && reviews >= 10 && reviews <= 120;
    return {
      eligible,
      level: high ? "high" : "standard",
      reason: high
        ? `${formatRating(rating)} puan · ${reviews} yorum · güçlü yerel görünürlük`
        : `${formatRating(rating)} puan · ${reviews} yorum`,
    };
  }

  const prioritySector = ACCOUNTING_SECTOR_PRIORITY.includes(
    (place.sector ?? "") as (typeof ACCOUNTING_SECTOR_PRIORITY)[number],
  ) || ACCOUNTING_PRIMARY_TYPE_PRIORITY.includes(place.primaryType);
  // B2B toptancılar son kullanıcı işletmeleri kadar yorum toplamaz; sektör uyumu daha güçlü sinyaldir.
  const eligible = quality === "selective"
    ? rating >= 4 && reviews >= 5 && reviews <= 200
    : quality === "broad"
      ? rating >= 3 && reviews >= 1 && reviews <= 500
      : rating >= 3.5 && reviews >= 2 && reviews <= 300;
  const high = eligible && rating >= 4 && reviews >= 3 && reviews <= 120 && prioritySector;
  return {
    eligible,
    level: high ? "high" : "standard",
    reason: high
      ? `${place.sector ?? "Stok/cari yoğun sektör"} · ön muhasebeye uygun · ${formatRating(rating)} puan · ${reviews} yorum`
      : `${formatRating(rating)} puan · ${reviews} yorum`,
  };
}

export function withPotential(place: PlaceDetails, leadType: LeadType): PlaceDetails {
  if (place.businessStatus === "UNKNOWN") {
    return { ...place, potentialLevel: "standard", potentialReason: undefined };
  }
  const assessment = assessPotential(place, leadType);
  return { ...place, potentialLevel: assessment.level, potentialReason: assessment.reason };
}

export function orderPotentialPlaces(places: PlaceDetails[], leadType: LeadType): PlaceDetails[] {
  return places
    .map((place) => withPotential(place, leadType))
    .sort((a, b) => {
      if (a.potentialLevel !== b.potentialLevel) return a.potentialLevel === "high" ? -1 : 1;
      if (leadType === "accounting") {
        const sectorDifference = sectorRank(a.sector) - sectorRank(b.sector);
        if (sectorDifference !== 0) return sectorDifference;
      }
      const reviewBandDifference = reviewBand(a.userRatingCount) - reviewBand(b.userRatingCount);
      if (reviewBandDifference !== 0) return reviewBandDifference;
      if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
      return b.userRatingCount - a.userRatingCount;
    });
}

function sectorRank(sector?: string) {
  const index = ACCOUNTING_SECTOR_PRIORITY.indexOf(
    (sector ?? "") as (typeof ACCOUNTING_SECTOR_PRIORITY)[number],
  );
  return index === -1 ? ACCOUNTING_SECTOR_PRIORITY.length : index;
}

function reviewBand(count: number) {
  if (count >= 10 && count <= 75) return 0;
  if (count >= 76 && count <= 200) return 1;
  if (count >= 5 && count <= 9) return 2;
  return 3;
}

function formatRating(rating: number) {
  return rating.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
