import type { PlaceDetails } from "@/types";

export type OverturePlaceRow = [
  id: string,
  name: string,
  address: string,
  province: string,
  mobile: string,
  contactUri: string | null,
  latitude: number,
  longitude: number,
  primaryType: string,
  sourceCategory: string,
  updatedAt: string | null,
  sector: string,
];

export function mapOverturePlace(
  row: OverturePlaceRow,
  metadata: { release: string; generatedAt: string },
): PlaceDetails {
  const [
    id,
    name,
    address,
    province,
    mobile,
    contactUri,
    latitude,
    longitude,
    primaryType,
    sourceCategory,
    updatedAt,
    sector,
  ] = row;
  return {
    placeId: `overture:${id}`,
    name,
    address,
    province,
    phone: mobile,
    internationalPhone: mobile,
    websiteUri: contactUri,
    mapUri: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
    businessStatus: "OPERATIONAL",
    primaryType,
    types: [primaryType, sourceCategory],
    typeLabel: sector,
    countryCode: "TR",
    rating: null,
    userRatingCount: 0,
    sector,
    dataSource: "overture",
    activityConfidence: "likely",
    activityReason: `Overture Maps ${metadata.release} açık veri sürümünde faal işletme`,
    lastVerifiedAt: updatedAt ?? metadata.generatedAt,
    whatsappEvidence: "mobile_only",
    whatsappReason: "Türkiye mobil numarası açık veri kaydında mevcut",
  };
}
