import type { LeadType, PlaceDetails } from "@/types";

type Rule = { match: RegExp; types: string[]; keywords: string[] };

// Google'ın döndürebildiği eski türler de doğrulamada tutulur; istek filtresinde yalnızca güncel Table A türleri kullanılır.
const RULES: Rule[] = [
  { match: /oto yikama|oto detay|arac kaplama/, types: ["car_wash", "car_repair"], keywords: ["oto", "detay", "kaplama", "wash"] },
  { match: /cam balkon|tente|tadilat|dekorasyon/, types: ["general_contractor", "home_improvement_store", "interior_designer"], keywords: ["cam", "balkon", "tente", "tadilat", "dekorasyon"] },
  { match: /temizlik sirketi|koltuk yikama|hali yikama|ilaclama/, types: ["service", "cleaning_service", "laundry", "pest_control_service"], keywords: ["temizlik", "koltuk", "hali", "ilaclama"] },
  { match: /guzellik|kuafor|berber/, types: ["beautician", "beauty_salon", "hair_care", "hair_salon", "barber_shop"], keywords: ["guzellik", "kuafor", "berber", "hair"] },
  { match: /diyetisyen|psikolog|fizyoterapist|dis klinigi/, types: ["nutritionist", "psychologist", "physiotherapist", "dental_clinic", "dentist"], keywords: ["diyet", "psikolog", "fizyo", "dis", "dental"] },
  { match: /veteriner/, types: ["veterinary_care"], keywords: ["veteriner", "pet"] },
  { match: /emlak/, types: ["real_estate_agency"], keywords: ["emlak", "gayrimenkul"] },
  { match: /mimarlik/, types: ["architect", "consultant"], keywords: ["mimar"] },
  { match: /fotograf|dugun salonu/, types: ["photographer", "wedding_venue", "event_venue"], keywords: ["fotograf", "dugun"] },
  { match: /spor salonu/, types: ["gym", "fitness_center", "sports_club"], keywords: ["spor", "fitness", "gym"] },
  { match: /anaokulu|egitim kursu/, types: ["preschool", "school", "educational_institution"], keywords: ["anaokul", "egitim", "kurs"] },
  { match: /matbaa/, types: ["print_shop"], keywords: ["matbaa", "baski"] },
  { match: /cicekci/, types: ["florist"], keywords: ["cicek"] },
  { match: /pastane/, types: ["bakery", "pastry_shop", "cake_shop"], keywords: ["pastane", "pasta", "firin"] },
  { match: /mobilyaci/, types: ["furniture_store", "manufacturer"], keywords: ["mobilya"] },
  { match: /elektrikci/, types: ["electrician"], keywords: ["elektrik"] },
  { match: /tesisatci|kombi servisi/, types: ["plumber", "service", "heating_contractor", "air_conditioning_repair_service"], keywords: ["tesisat", "kombi", "isitma"] },
  { match: /nakliyat|transfer/, types: ["moving_company", "transportation_service", "shipping_service"], keywords: ["nakliyat", "transfer", "tasima"] },
  { match: /arac kiralama/, types: ["car_rental"], keywords: ["kiralama", "rent"] },
  { match: /gida toptancisi/, types: ["wholesaler", "supplier", "food_store", "grocery_store", "warehouse_store"], keywords: ["gida", "erzak"] },
  { match: /icecek toptancisi/, types: ["wholesaler", "supplier", "liquor_store"], keywords: ["icecek", "mesrubat"] },
  { match: /temizlik malzemeleri/, types: ["wholesaler", "supplier"], keywords: ["temizlik", "deterjan"] },
  { match: /ambalaj/, types: ["wholesaler", "supplier", "packaging_supply_store"], keywords: ["ambalaj", "paket"] },
  { match: /oto yedek parca/, types: ["auto_parts_store", "wholesaler", "supplier"], keywords: ["yedek", "parca", "otomotiv"] },
  { match: /hirdavat/, types: ["hardware_store", "wholesaler", "supplier"], keywords: ["hirdavat"] },
  { match: /yapi malzemeleri/, types: ["building_materials_store", "hardware_store", "wholesaler", "supplier"], keywords: ["yapi", "insaat"] },
  { match: /elektrik malzemeleri/, types: ["wholesaler", "supplier"], keywords: ["elektrik"] },
  { match: /tekstil/, types: ["clothing_store", "wholesaler", "supplier", "manufacturer"], keywords: ["tekstil", "kumas"] },
  { match: /kirtasiye/, types: ["stationery_store", "wholesaler", "supplier"], keywords: ["kirtasiye"] },
  { match: /medikal/, types: ["supplier", "wholesaler"], keywords: ["medikal", "saglik"] },
  { match: /endustriyel/, types: ["supplier", "manufacturer", "wholesaler"], keywords: ["endustri", "sanayi"] },
  { match: /mobilya ureticisi/, types: ["manufacturer", "furniture_store"], keywords: ["mobilya"] },
  { match: /plastik/, types: ["manufacturer"], keywords: ["plastik"] },
  { match: /yem bayisi|tarim urunleri/, types: ["farm", "supplier", "wholesaler"], keywords: ["yem", "tarim", "ziraat"] },
  { match: /toptanci|dagitim firmasi/, types: ["wholesaler", "warehouse_store", "supplier", "transportation_service"], keywords: ["toptan", "dagitim", "tedarik"] },
];

export function assessSectorRelevance(place: PlaceDetails, sector: string, leadType: LeadType) {
  const normalizedSector = normalize(sector);
  const normalizedName = normalize(place.name);
  const normalizedLabel = normalize(place.typeLabel ?? "");
  const placeTypes = new Set(
    [place.primaryType, ...(Array.isArray(place.types) ? place.types : [])]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase()),
  );
  const rule = RULES.find((item) => item.match.test(normalizedSector));
  const sectorTokens = normalizedSector.split(/\s+/).filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
  const keywords = [...new Set([...(rule?.keywords ?? []), ...sectorTokens])];
  const nameMatch = keywords.some((keyword) => normalizedName.includes(keyword));
  const labelMatch = keywords.some((keyword) => normalizedLabel.includes(keyword));
  const typeMatch = rule?.types.some((type) => placeTypes.has(type)) ?? false;
  const typeTextMatch = keywords.some((keyword) => [...placeTypes].some((type) => normalize(type).includes(keyword)));
  const score = (typeMatch ? 5 : 0) + (nameMatch ? 5 : 0) + (labelMatch ? 4 : 0) + (typeTextMatch ? 2 : 0);
  // Ön muhasebede yalnızca "toptancı" gibi genel bir Google türü yeterli değildir; ikinci bir sektör sinyali aranır.
  const threshold = leadType === "accounting" ? 8 : 5;
  return {
    eligible: score >= threshold,
    score,
    reason: nameMatch && typeMatch ? "işletme adı ve türü eşleşti" : labelMatch && typeMatch ? "Google kategorisi ve türü eşleşti" : typeMatch ? "işletme türü eşleşti" : nameMatch ? "işletme adı eşleşti" : labelMatch ? "Google kategorisi eşleşti" : "sektör sinyali bulunamadı",
  };
}

export function includedTypeForSector(sector: string): string | undefined {
  const value = normalize(sector);
  if (/oto yikama|oto detay/.test(value)) return "car_wash";
  if (/arac kaplama/.test(value)) return "car_repair";
  if (/cam balkon|tente|tadilat|dekorasyon/.test(value)) return "home_improvement_store";
  if (/guzellik/.test(value)) return "beauty_salon";
  if (/kuafor/.test(value)) return "hair_salon";
  if (/berber/.test(value)) return "barber_shop";
  if (/fizyoterapist/.test(value)) return "physiotherapist";
  if (/dis klinigi/.test(value)) return "dental_clinic";
  if (/veteriner/.test(value)) return "veterinary_care";
  if (/emlak/.test(value)) return "real_estate_agency";
  if (/dugun salonu/.test(value)) return "wedding_venue";
  if (/spor salonu/.test(value)) return "gym";
  if (/anaokulu/.test(value)) return "preschool";
  if (/egitim kursu/.test(value)) return "educational_institution";
  if (/cicekci/.test(value)) return "florist";
  if (/pastane/.test(value)) return "bakery";
  if (/mobilyaci/.test(value)) return "furniture_store";
  if (/elektrikci/.test(value)) return "electrician";
  if (/tesisatci|kombi servisi/.test(value)) return "plumber";
  if (/nakliyat/.test(value)) return "moving_company";
  if (/transfer/.test(value)) return "transportation_service";
  if (/arac kiralama/.test(value)) return "car_rental";
  if (/mobilya ureticisi|plastik urun ureticisi/.test(value)) return "manufacturer";
  if (/medikal|endustriyel|yem bayisi/.test(value)) return "supplier";
  if (/toptanci|toptancisi|dagitim firmasi/.test(value)) return "wholesaler";
  return undefined;
}

const STOP_WORDS = new Set(["toptancisi", "tedarikcisi", "ureticisi", "firmasi", "sirketi", "ofisi", "salonu", "servisi", "klinigi", "danismani", "malzemeleri", "urunleri", "ozel"]);

export function normalizePlaceText(value: unknown) {
  return normalize(value);
}

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g").replaceAll("ç", "c").replaceAll("ö", "o").replaceAll("ü", "u").replace(/[^a-z0-9]+/g, " ").trim();
}
