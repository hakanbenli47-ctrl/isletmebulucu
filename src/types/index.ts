export type LeadType = "website" | "accounting";
export type LeadQuality = "recommended" | "selective" | "broad";

export type LeadStatus =
  | "new"
  | "contacted"
  | "not_suitable"
  | "no_whatsapp"
  | "customer"
  | "archived";

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  province: string;
  phone: string | null;
  internationalPhone: string | null;
  websiteUri: string | null;
  googleMapsUri: string;
  businessStatus: string;
  primaryType: string;
  rating: number | null;
  userRatingCount: number;
  potentialLevel?: "high" | "standard";
  potentialReason?: string;
  sector?: string;
  isDemo?: boolean;
}

export interface LeadRecord {
  id: string;
  place_id: string;
  lead_type: LeadType;
  status: LeadStatus;
  contacted_at: string | null;
  created_at: string;
  details: PlaceDetails;
}

export interface AppSettings {
  resultsPerSearch: number;
  dailyContactGoal: number;
  websiteSectors: string[];
  accountingSectors: string[];
  websiteMessage: string;
  accountingMessage: string;
}
