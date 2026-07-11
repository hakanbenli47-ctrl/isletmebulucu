import type { LeadType, PlaceDetails } from "@/types";

type Rule = { match: RegExp; types: string[]; keywords: string[] };

const RULES: Rule[] = [
  { match: /oto yikama|oto detay|arac kaplama/, types: ["car_wash", "auto_detailing_service", "car_repair"], keywords: ["oto", "detay", "kaplama", "wash"] },
  { match: /cam balkon|tente|tadilat|dekorasyon/, types: ["contractor", "general_contractor", "home_improvement_store", "interior_designer"], keywords: ["cam", "balkon", "tente", "tadilat", "dekorasyon"] },
  { match: /temizlik sirketi|koltuk yikama|hali yikama|ilaclama/, types: ["cleaning_service", "laundry", "pest_control_service"], keywords: ["temizlik", "koltuk", "hali", "ilaclama"] },
  { match: /guzellik|kuafor|berber/, types: ["beauty_salon", "hair_salon", "barber_shop"], keywords: ["guzellik", "kuafor", "berber", "hair"] },
  { match: /diyetisyen|psikolog|fizyoterapist|dis klinigi/, types: ["nutritionist", "psychologist", "physiotherapist", "dental_clinic", "dentist"], keywords: ["diyet", "psikolog", "fizyo", "dis", "dental"] },
  { match: /veteriner/, types: ["veterinary_care", "veterinarian"], keywords: ["veteriner", "pet"] },
  { match: /emlak/, types: ["real_estate_agency", "real_estate_agent"], keywords: ["emlak", "gayrimenkul"] },
  { match: /mimarlik/, types: ["architect", "architecture_firm"], keywords: ["mimar"] },
  { match: /fotograf|dugun salonu/, types: ["photographer", "wedding_venue", "event_venue"], keywords: ["fotograf", "dugun"] },
  { match: /spor salonu/, types: ["gym", "fitness_center"], keywords: ["spor", "fitness", "gym"] },
  { match: /anaokulu|egitim kursu/, types: ["preschool", "school", "education_center"], keywords: ["anaokul", "egitim", "kurs"] },
  { match: /matbaa/, types: ["print_shop"], keywords: ["matbaa", "baski"] },
  { match: /cicekci/, types: ["florist"], keywords: ["cicek"] },
  { match: /pastane/, types: ["bakery", "pastry_shop"], keywords: ["pastane", "pasta", "firin"] },
  { match: /mobilyaci/, types: ["furniture_store", "furniture_maker"], keywords: ["mobilya"] },
  { match: /elektrikci/, types: ["electrician"], keywords: ["elektrik"] },
  { match: /tesisatci|kombi servisi/, types: ["plumber", "heating_contractor", "air_conditioning_repair_service"], keywords: ["tesisat", "kombi", "isitma"] },
  { match: /nakliyat|transfer/, types: ["moving_company", "transportation_service", "shipping_service"], keywords: ["nakliyat", "transfer", "tasima"] },
  { match: /arac kiralama/, types: ["car_rental"], keywords: ["kiralama", "rent"] },
  { match: /gida toptancisi/, types: ["wholesaler", "food_store", "grocery_store", "warehouse_store"], keywords: ["gida", "erzak"] },
  { match: /icecek toptancisi/, types: ["wholesaler", "beverage_distributor", "liquor_store"], keywords: ["icecek", "mesrubat"] },
  { match: /temizlik malzemeleri/, types: ["wholesaler", "cleaning_products_supplier"], keywords: ["temizlik", "deterjan"] },
  { match: /ambalaj/, types: ["wholesaler", "packaging_supply_store"], keywords: ["ambalaj", "paket"] },
  { match: /oto yedek parca/, types: ["auto_parts_store", "wholesaler"], keywords: ["yedek", "parca", "otomotiv"] },
  { match: /hirdavat/, types: ["hardware_store", "wholesaler"], keywords: ["hirdavat"] },
  { match: /yapi malzemeleri/, types: ["building_materials_store", "hardware_store", "wholesaler"], keywords: ["yapi", "insaat"] },
  { match: /elektrik malzemeleri/, types: ["electrical_supply_store", "wholesaler"], keywords: ["elektrik"] },
  { match: /tekstil/, types: ["fabric_store", "clothing_store", "wholesaler"], keywords: ["tekstil", "kumas"] },
  { match: /kirtasiye/, types: ["stationery_store", "wholesaler"], keywords: ["kirtasiye"] },
  { match: /medikal/, types: ["medical_supply_store", "wholesaler"], keywords: ["medikal", "saglik"] },
  { match: /endustriyel/, types: ["industrial_equipment_supplier", "manufacturer", "wholesaler"], keywords: ["endustri", "sanayi"] },
  { match: /mobilya ureticisi/, types: ["furniture_maker", "manufacturer", "furniture_store"], keywords: ["mobilya"] },
  { match: /plastik/, types: ["manufacturer"], keywords: ["plastik"] },
  { match: /yem bayisi|tarim urunleri/, types: ["farm_shop", "agricultural_service", "wholesaler"], keywords: ["yem", "tarim", "ziraat"] },
  { match: /toptanci|dagitim firmasi/, types: ["wholesaler", "warehouse_store", "distribution_service"], keywords: ["toptan", "dagitim", "tedarik"] },
];

export function assessSectorRelevance(place: PlaceDetails, sector: string, leadType: LeadType) {
  const normalizedSector = normalize(sector);
  const normalizedName = normalize(place.name);
  const primaryType = place.primaryType.toLowerCase();
  const rule = RULES.find((item) => item.match.test(normalizedSector));
  const sectorTokens = normalizedSector.split(/\s+/).filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
  const keywords = [...new Set([...(rule?.keywords ?? []), ...sectorTokens])];
  const nameMatch = keywords.some((keyword) => normalizedName.includes(keyword));
  const typeMatch = rule?.types.includes(primaryType) ?? false;
  const typeTextMatch = keywords.some((keyword) => normalize(primaryType).includes(keyword));
  const score = (typeMatch ? 5 : 0) + (nameMatch ? 5 : 0) + (typeTextMatch ? 3 : 0);
  const threshold = leadType === "accounting" ? 5 : 3;
  return { eligible: score >= threshold, score, reason: typeMatch ? "işletme türü eşleşti" : nameMatch ? "işletme adı eşleşti" : typeTextMatch ? "kategori eşleşti" : "sektör sinyali bulunamadı" };
}

const STOP_WORDS = new Set(["toptancisi", "tedarikcisi", "ureticisi", "firmasi", "sirketi", "ofisi", "salonu", "servisi", "klinigi", "danismani", "malzemeleri", "urunleri", "ozel"]);

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g").replaceAll("ç", "c").replaceAll("ö", "o").replaceAll("ü", "u").replace(/[^a-z0-9]+/g, " ").trim();
}
