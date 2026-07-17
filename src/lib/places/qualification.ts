import type { LeadQuality, LeadType, PlaceDetails } from "@/types";
import { normalizeTurkishPhone } from "../whatsapp/index";
import { isOpenedWithinLastTwoYears } from "./activity";
import { assessPotential } from "./potential";
import { assessSectorRelevance, normalizePlaceText } from "./relevance";
import { isIndependentWebsite, isInstagramProfile, socialProfileType } from "./website";

export type PresenceFilter = "all" | "instagram" | "no_social";

export interface QualificationDiagnostics {
  total: number;
  accepted: number;
  duplicatePlace: number;
  duplicateMobile: number;
  inactive: number;
  notRecentlyOpened: number;
  wrongLocation: number;
  invalidMobile: number;
  independentWebsite: number;
  presenceMismatch: number;
  irrelevantSector: number;
  lowQuality: number;
}

interface QualificationOptions {
  leadType: LeadType;
  sector: string;
  province: string;
  quality: LeadQuality;
  presence: PresenceFilter;
  seenPlaceIds: Set<string>;
  seenMobiles: Set<string>;
  limit: number;
  diagnostics: QualificationDiagnostics;
}

export function createQualificationDiagnostics(): QualificationDiagnostics {
  return { total: 0, accepted: 0, duplicatePlace: 0, duplicateMobile: 0, inactive: 0, notRecentlyOpened: 0, wrongLocation: 0, invalidMobile: 0, independentWebsite: 0, presenceMismatch: 0, irrelevantSector: 0, lowQuality: 0 };
}

export function qualifySearchResults(places: PlaceDetails[], options: QualificationOptions) {
  const accepted: PlaceDetails[] = [];

  for (const place of places) {
    if (accepted.length >= options.limit) break;
    options.diagnostics.total += 1;

    if (options.seenPlaceIds.has(place.placeId)) {
      options.diagnostics.duplicatePlace += 1;
      continue;
    }
    if (place.businessStatus !== "OPERATIONAL") {
      options.diagnostics.inactive += 1;
      continue;
    }
    if (!isOpenedWithinLastTwoYears(place.openedAt)) {
      options.diagnostics.notRecentlyOpened += 1;
      continue;
    }
    if (!matchesLocation(place, options.province)) {
      options.diagnostics.wrongLocation += 1;
      continue;
    }

    const mobile = normalizeTurkishPhone(place.internationalPhone ?? place.phone);
    if (!mobile) {
      options.diagnostics.invalidMobile += 1;
      continue;
    }
    if (options.leadType === "website" && isIndependentWebsite(place.websiteUri)) {
      options.diagnostics.independentWebsite += 1;
      continue;
    }
    if (!matchesPresence(place.websiteUri, options.leadType, options.presence)) {
      options.diagnostics.presenceMismatch += 1;
      continue;
    }
    if (!assessSectorRelevance(place, options.sector, options.leadType).eligible) {
      options.diagnostics.irrelevantSector += 1;
      continue;
    }
    if (!assessPotential(place, options.leadType, options.quality).eligible) {
      options.diagnostics.lowQuality += 1;
      continue;
    }
    if (options.seenMobiles.has(mobile)) {
      options.diagnostics.duplicateMobile += 1;
      continue;
    }

    options.seenPlaceIds.add(place.placeId);
    options.seenMobiles.add(mobile);
    options.diagnostics.accepted += 1;
    accepted.push(place);
  }

  return accepted;
}

export function formatQualificationSummary(diagnostics: QualificationDiagnostics) {
  const reasons = [
    [diagnostics.invalidMobile, "WhatsApp'a uygun cep telefonu yok"],
    [diagnostics.wrongLocation, "il/ülke doğrulanmadı"],
    [diagnostics.irrelevantSector, "sektör eşleşmedi"],
    [diagnostics.lowQuality, "aday kalite ölçütü yetersiz"],
    [diagnostics.independentWebsite + diagnostics.presenceMismatch, "dijital kanal ölçütüne uymadı"],
    [diagnostics.inactive, "faal görünmüyor"],
    [diagnostics.notRecentlyOpened, "son iki yılda açıldığı doğrulanmadı"],
    [diagnostics.duplicatePlace + diagnostics.duplicateMobile, "tekrar kayıt"],
  ] as const;
  const rejected = reasons.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join(", ");
  return rejected ? `${diagnostics.total} açık veri sonucu denetlendi; ${rejected} olduğu için elendi.` : `${diagnostics.total} açık veri sonucu denetlendi.`;
}

function matchesLocation(place: PlaceDetails, province: string) {
  return place.countryCode === "TR" && normalizePlaceText(place.province) === normalizePlaceText(province);
}

function matchesPresence(uri: string | null | undefined, leadType: LeadType, presence: PresenceFilter) {
  if (leadType === "accounting" || presence === "all") return true;
  if (presence === "instagram") return isInstagramProfile(uri);
  return socialProfileType(uri) === null;
}

