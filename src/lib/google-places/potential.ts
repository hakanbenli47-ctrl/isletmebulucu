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
  score: number;
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
    const score = websiteScore(place);
    const high = eligible && score >= 75;
    return {
      eligible,
      level: high ? "high" : "standard",
      score,
      reason: `${score}/100 potansiyel · ${formatRating(rating)} puan · ${reviews} yorum`,
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
  const score = accountingScore(place, prioritySector);
  const high = eligible && score >= 75;
  return {
    eligible,
    level: high ? "high" : "standard",
    score,
    reason: high
      ? `${score}/100 potansiyel · ${place.sector ?? "stok/cari yoğun sektör"}`
      : `${score}/100 potansiyel · ${formatRating(rating)} puan · ${reviews} yorum`,
  };
}

export function withPotential(place: PlaceDetails, leadType: LeadType): PlaceDetails {
  if (place.businessStatus === "UNKNOWN") {
    return { ...place, potentialLevel: "standard", potentialReason: undefined };
  }
  const assessment = assessPotential(place, leadType);
  return { ...place, potentialLevel: assessment.level, potentialScore: assessment.score, potentialReason: assessment.reason };
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

function websiteScore(place: PlaceDetails) {
  const rating = place.rating ?? 0;
  const reviews = place.userRatingCount;
  const ratingPoints = rating >= 4.7 ? 35 : rating >= 4.4 ? 31 : rating >= 4 ? 25 : rating >= 3.8 ? 17 : 5;
  const reviewPoints = reviews >= 10 && reviews <= 120 ? 30 : reviews >= 5 && reviews <= 250 ? 24 : reviews >= 2 && reviews <= 500 ? 14 : 5;
  const websiteNeed = place.websiteUri ? 5 : 20;
  const contactPoints = place.phone || place.internationalPhone ? 15 : 0;
  return Math.min(100, ratingPoints + reviewPoints + websiteNeed + contactPoints);
}

function accountingScore(place: PlaceDetails, prioritySector: boolean) {
  const rating = place.rating ?? 0;
  const reviews = place.userRatingCount;
  const sectorPoints = prioritySector ? 40 : 22;
  const ratingPoints = rating >= 4.5 ? 25 : rating >= 4 ? 22 : rating >= 3.5 ? 17 : 8;
  const reviewPoints = reviews >= 3 && reviews <= 120 ? 20 : reviews >= 1 && reviews <= 300 ? 14 : 6;
  const contactPoints = place.phone || place.internationalPhone ? 15 : 0;
  return Math.min(100, sectorPoints + ratingPoints + reviewPoints + contactPoints);
}
