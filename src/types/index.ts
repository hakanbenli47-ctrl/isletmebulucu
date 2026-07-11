export type LeadType = "website" | "accounting";
export type LeadQuality = "recommended" | "selective" | "broad";

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "interested"
  | "demo_sent"
  | "follow_up"
  | "not_suitable"
  | "no_whatsapp"
  | "opted_out"
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
  instagramActivity?: "active" | "inactive" | "unverified";
  instagramLastPostAt?: string;
  instagramFollowers?: number;
  potentialLevel?: "high" | "standard";
  potentialScore?: number;
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
  next_follow_up_at: string | null;
  contact_count: number;
  notes: string | null;
  source_province: string | null;
  source_sector: string | null;
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
  instagramMessage: string;
  websiteFollowUpMessage: string;
  accountingFollowUpMessage: string;
  instagramFollowUpMessage: string;
  firstFollowUpDays: number;
  finalFollowUpDays: number;
  maxFollowUps: number;
}

export interface ReferralPartner {
  id: string;
  name: string;
  partner_type: "accountant" | "it" | "printing" | "agency" | "supplier" | "customer" | "other";
  contact: string;
  status: "candidate" | "contacted" | "active" | "paused";
  notes: string | null;
  referrals_count: number;
  customers_count: number;
  next_follow_up_at: string | null;
  created_at: string;
}
