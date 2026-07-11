import { DEFAULT_SETTINGS } from "@/data/defaults";
import type { AppSettings, LeadRecord, LeadStatus, LeadType, PlaceDetails } from "@/types";

const places: PlaceDetails[] = [
  { placeId: "demo-web-1", name: "Akdeniz Oto Detaylandırma", address: "Fener Mah. 1967 Sok. No:12 Muratpaşa/Antalya", province: "Antalya", phone: "0532 444 18 07", internationalPhone: "+90 532 444 18 07", websiteUri: "https://instagram.com/akdenizdetay", googleMapsUri: "https://maps.google.com/?q=Akdeniz+Oto+Detay", businessStatus: "OPERATIONAL", primaryType: "car_wash", rating: 4.7, userRatingCount: 38, sector: "Oto detaylandırma", potentialLevel: "high", potentialReason: "4,7 puan · 38 yorum · güçlü yerel görünürlük", isDemo: true },
  { placeId: "demo-web-2", name: "Başkent Cam Balkon", address: "İvedik OSB, Yenimahalle/Ankara", province: "Ankara", phone: "0541 285 33 22", internationalPhone: "+90 541 285 33 22", websiteUri: null, googleMapsUri: "https://maps.google.com/?q=Başkent+Cam+Balkon", businessStatus: "OPERATIONAL", primaryType: "contractor", rating: 4.5, userRatingCount: 22, sector: "Cam balkon", potentialLevel: "high", potentialReason: "4,5 puan · 22 yorum · güçlü yerel görünürlük", isDemo: true },
  { placeId: "demo-web-3", name: "Ege Koltuk Yıkama", address: "Kazımdirik Mah. Bornova/İzmir", province: "İzmir", phone: "0507 318 62 90", internationalPhone: "+90 507 318 62 90", websiteUri: "https://facebook.com/egekoltukyikama", googleMapsUri: "https://maps.google.com/?q=Ege+Koltuk+Yikama", businessStatus: "OPERATIONAL", primaryType: "cleaning_service", rating: 4.2, userRatingCount: 64, sector: "Koltuk yıkama", potentialLevel: "standard", potentialReason: "4,2 puan · 64 yorum", isDemo: true },
  { placeId: "demo-acc-1", name: "Marmara Teknik Servis", address: "Osmangazi Mah. Nilüfer/Bursa", province: "Bursa", phone: "0553 720 14 44", internationalPhone: "+90 553 720 14 44", websiteUri: "https://marmarateknik.example", googleMapsUri: "https://maps.google.com/?q=Marmara+Teknik+Servis", businessStatus: "OPERATIONAL", primaryType: "repair_service", rating: 4.3, userRatingCount: 47, sector: "Teknik servis", potentialLevel: "standard", potentialReason: "4,3 puan · 47 yorum", isDemo: true },
  { placeId: "demo-acc-2", name: "Güney Yapı Malzemeleri", address: "Şehitkamil/Gaziantep", province: "Gaziantep", phone: "0530 611 09 73", internationalPhone: "+90 530 611 09 73", websiteUri: null, googleMapsUri: "https://maps.google.com/?q=Guney+Yapi", businessStatus: "OPERATIONAL", primaryType: "building_materials_store", rating: 4.6, userRatingCount: 83, sector: "Yapı malzemeleri", potentialLevel: "high", potentialReason: "Yapı malzemeleri · ön muhasebeye uygun · 4,6 puan · 83 yorum", isDemo: true },
  { placeId: "demo-contacted-1", name: "Karadeniz Klima Servisi", address: "Ortahisar/Trabzon", province: "Trabzon", phone: "0544 901 27 65", internationalPhone: "+90 544 901 27 65", websiteUri: null, googleMapsUri: "https://maps.google.com/?q=Karadeniz+Klima", businessStatus: "OPERATIONAL", primaryType: "air_conditioning_repair_service", rating: 4.1, userRatingCount: 29, sector: "Klima servisi", potentialLevel: "standard", potentialReason: "4,1 puan · 29 yorum", isDemo: true },
];

const now = new Date();
const initialRecords: LeadRecord[] = places.map((details, index) => ({
  id: `00000000-0000-0000-0000-${String(index + 10).padStart(12, "0")}`,
  place_id: details.placeId,
  lead_type: details.placeId.includes("acc") || details.placeId.includes("contacted") ? "accounting" : "website",
  status: details.placeId.includes("contacted") ? "contacted" : "new",
  contacted_at: details.placeId.includes("contacted") ? now.toISOString() : null,
  created_at: new Date(now.getTime() - index * 86_400_000).toISOString(),
  details,
}));

type MockStore = { records: LeadRecord[]; settings: AppSettings; counter: number };
const globalStore = globalThis as typeof globalThis & { __isletmeMock?: MockStore };
export const mockStore = globalStore.__isletmeMock ??= {
  records: structuredClone(initialRecords),
  settings: structuredClone(DEFAULT_SETTINGS),
  counter: 100,
};

export function mockSearch(leadType: LeadType, count: number) {
  const template = places.find((place) => leadType === "website" ? place.placeId.includes("web") : place.placeId.includes("acc"))!;
  const created = Array.from({ length: Math.min(count, 6) }, () => {
    const n = mockStore.counter++;
    const details: PlaceDetails = { ...template, placeId: `demo-${leadType}-${n}`, name: `${leadType === "website" ? "Yeni İşletme" : "Yeni Ticaret"} ${n}`, isDemo: true };
    const record: LeadRecord = { id: crypto.randomUUID(), place_id: details.placeId, lead_type: leadType, status: "new", contacted_at: null, created_at: new Date().toISOString(), details };
    mockStore.records.unshift(record);
    return record;
  });
  return created;
}

export function updateMockLead(placeId: string, status: LeadStatus) {
  const record = mockStore.records.find((item) => item.place_id === placeId);
  if (!record) return null;
  record.status = status;
  record.contacted_at = status === "contacted" ? new Date().toISOString() : status === "new" ? null : record.contacted_at;
  return record;
}
