import type { LeadQuality, LeadType, PlaceDetails } from "@/types";
import { normalizeTurkishPhone } from "../whatsapp/index";
import { isInstagramProfile } from "./website";
import { openingRecencyStatus } from "./activity";

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
  "supplier", "manufacturer", "warehouse_store", "furniture_store",
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
  const contactable = place.businessStatus === "OPERATIONAL" && Boolean(normalizeTurkishPhone(place.internationalPhone ?? place.phone));

  if (place.dataSource === "openstreetmap") {
    const websiteNeed = isInstagramProfile(place.websiteUri) ? 20 : place.websiteUri ? 5 : 18;
    const profilePoints = place.name && place.address ? 10 : 5;
    const recency = openingRecencyStatus(place.openedAt);
    const activityPoints = recency === "recent" ? 12 : place.activityConfidence === "likely" ? 6 : 0;
    const score = leadType === "website"
      ? Math.min(100, 25 + 20 + websiteNeed + profilePoints + activityPoints)
      : Math.min(100, 25 + (isPriorityAccountingSector(place) ? 35 : 25) + profilePoints + activityPoints);
    const eligible = contactable && recency !== "old" && (quality !== "selective" || place.activityConfidence !== "unknown");
    return {
      eligible,
      level: eligible && score >= 75 ? "high" : "standard",
      score,
      reason: recency === "recent"
        ? `${score}/100 potansiyel · ${place.openedAt} açılış · faal açık veri kaydı`
        : `${score}/100 potansiyel · açılış tarihi kayıtlı değil · kapanış işareti yok`,
    };
  }

  if (leadType === "website") {
    const eligibleByQuality = quality === "selective"
      ? rating >= 4.4 && reviews >= 10 && reviews <= 150
      : quality === "broad"
        ? rating >= 3.8 && reviews >= 2 && reviews <= 500
        : rating >= 4 && reviews >= 5 && reviews <= 250;
    const eligible = contactable && eligibleByQuality;
    const score = websiteScore(place);
    const high = eligible && score >= 75;
    return {
      eligible,
      level: high ? "high" : "standard",
      score,
      reason: `${score}/100 potansiyel · ${formatRating(rating)} puan · ${reviews} yorum${place.instagramActivity === "active" ? " · Instagram aktif" : isInstagramProfile(place.websiteUri) ? " · Instagram bağlantısı var" : ""}`,
    };
  }

  const prioritySector = isPriorityAccountingSector(place);
  // B2B toptancılar son kullanıcı işletmeleri kadar yorum toplamaz; sektör uyumu daha güçlü sinyaldir.
  const eligibleByQuality = quality === "selective"
    ? rating >= 4 && reviews >= 5 && reviews <= 200
    : quality === "broad"
      ? rating >= 3 && reviews >= 1 && reviews <= 500
      : rating >= 3.5 && reviews >= 2 && reviews <= 300;
  const eligible = contactable && eligibleByQuality;
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

function isPriorityAccountingSector(place: PlaceDetails) {
  return ACCOUNTING_SECTOR_PRIORITY.includes(
    (place.sector ?? "") as (typeof ACCOUNTING_SECTOR_PRIORITY)[number],
  ) || [place.primaryType, ...(place.types ?? [])].some((type) => ACCOUNTING_PRIMARY_TYPE_PRIORITY.includes(type));
}

export function withPotential(place: PlaceDetails, leadType: LeadType, quality: LeadQuality = "recommended"): PlaceDetails {
  if (place.businessStatus === "UNKNOWN") {
    return { ...place, potentialLevel: "standard", potentialReason: undefined };
  }
  const assessment = assessPotential(place, leadType, quality);
  return { ...place, potentialLevel: assessment.level, potentialScore: assessment.score, potentialReason: assessment.reason };
}

export function orderPotentialPlaces(places: PlaceDetails[], leadType: LeadType, quality: LeadQuality = "recommended"): PlaceDetails[] {
  return places
    .map((place) => withPotential(place, leadType, quality))
    .sort((a, b) => {
      const whatsappDifference = whatsappEvidenceRank(a.whatsappEvidence) - whatsappEvidenceRank(b.whatsappEvidence);
      if (whatsappDifference !== 0) return whatsappDifference;
      if (a.potentialLevel !== b.potentialLevel) return a.potentialLevel === "high" ? -1 : 1;
      if (a.instagramActivity !== b.instagramActivity) return instagramActivityRank(a.instagramActivity) - instagramActivityRank(b.instagramActivity);
      if (leadType === "accounting") {
        const sectorDifference = sectorRank(a.sector) - sectorRank(b.sector);
        if (sectorDifference !== 0) return sectorDifference;
      }
      const reviewBandDifference = reviewBand(a.userRatingCount) - reviewBand(b.userRatingCount);
      if (reviewBandDifference !== 0) return reviewBandDifference;
      if ((b.potentialScore ?? 0) !== (a.potentialScore ?? 0)) return (b.potentialScore ?? 0) - (a.potentialScore ?? 0);
      if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
      return b.userRatingCount - a.userRatingCount;
    });
}

function whatsappEvidenceRank(evidence?: PlaceDetails["whatsappEvidence"]) {
  if (evidence === "explicit_tag" || evidence === "explicit_link") return 0;
  if (evidence === "mobile_only") return 1;
  return 2;
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

function instagramActivityRank(activity?: PlaceDetails["instagramActivity"]) {
  if (activity === "active") return 0;
  if (activity === "unverified") return 1;
  if (activity === "inactive") return 2;
  return 3;
}

function formatRating(rating: number) {
  return rating.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function websiteScore(place: PlaceDetails) {
  const rating = place.rating ?? 0;
  const reviews = place.userRatingCount;
  const ratingPoints = rating >= 4.7 ? 30 : rating >= 4.4 ? 27 : rating >= 4 ? 22 : rating >= 3.8 ? 15 : 5;
  const reviewPoints = reviews >= 10 && reviews <= 120 ? 25 : reviews >= 5 && reviews <= 250 ? 21 : reviews >= 2 && reviews <= 500 ? 12 : 5;
  const websiteNeed = isInstagramProfile(place.websiteUri) ? 20 : place.websiteUri ? 8 : 15;
  const contactPoints = normalizeTurkishPhone(place.internationalPhone ?? place.phone) ? 15 : 0;
  const activityPoints = place.instagramActivity === "active" ? 10 : place.instagramActivity === "inactive" ? 0 : isInstagramProfile(place.websiteUri) ? 5 : 0;
  return Math.min(100, ratingPoints + reviewPoints + websiteNeed + contactPoints + activityPoints);
}

function accountingScore(place: PlaceDetails, prioritySector: boolean) {
  const rating = place.rating ?? 0;
  const reviews = place.userRatingCount;
  const sectorPoints = prioritySector ? 40 : 22;
  const ratingPoints = rating >= 4.5 ? 25 : rating >= 4 ? 22 : rating >= 3.5 ? 17 : 8;
  const reviewPoints = reviews >= 3 && reviews <= 120 ? 20 : reviews >= 1 && reviews <= 300 ? 14 : 6;
  const contactPoints = normalizeTurkishPhone(place.internationalPhone ?? place.phone) ? 15 : 0;
  return Math.min(100, sectorPoints + ratingPoints + reviewPoints + contactPoints);
}
