import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "../../data/sectors";

export type SearchableSector = (typeof WEBSITE_SECTORS)[number] | (typeof ACCOUNTING_SECTORS)[number];

const text = (pattern: string) => `["name"~"${pattern}",i]`;

// Her ürün sektörü kendi OSM etiketleriyle ayrı sorgulanır. Yapısal etiketin Türkiye'de
// seyrek kullanıldığı alanlarda hızlı ve indekslenebilir işletme adı yedeği de bulunur.
export const SECTOR_SELECTORS = {
  "Oto yıkama": ['["amenity"="car_wash"]'],
  "Oto detaylandırma": [text("oto detay|detailing|detaylandırma|detaylama")],
  "Araç kaplama": [text("araç kaplama|oto kaplama|folyo kaplama|car wrap")],
  "Cam balkon": ['["craft"="glaziery"]', '["craft"="window_construction"]', text("cam balkon")],
  Tente: ['["craft"="awning"]', text("tente|gölgelendirme")],
  Tadilat: ['["craft"="builder"]', '["office"="construction_company"]', text("tadilat|yapı dekorasyon|renovasyon")],
  Dekorasyon: ['["office"="interior_design"]', '["shop"="interior_decoration"]', text("dekorasyon|iç mimar")],
  "Temizlik şirketi": ['["office"="cleaning"]', '["craft"="cleaning"]', text("temizlik")],
  "Koltuk yıkama": [text("koltuk yıkama|koltuk temizleme")],
  "Halı yıkama": ['["shop"="laundry"]', text("halı yıkama|halı temizleme")],
  İlaçlama: ['["craft"="pest_control"]', text("ilaçlama|pest control")],
  "Güzellik salonu": ['["shop"="beauty"]'],
  Kuaför: ['["shop"="hairdresser"]'],
  Berber: ['["shop"="hairdresser"]["hairdresser"="male"]', text("berber")],
  Diyetisyen: ['["healthcare"="dietitian"]', text("diyetisyen|beslenme danışman")],
  Psikolog: ['["healthcare"="psychotherapist"]', '["office"="therapist"]', text("psikolog|psikoterapi")],
  Fizyoterapist: ['["healthcare"="physiotherapist"]', text("fizyoterapi|fizik tedavi")],
  "Diş kliniği": ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  "Veteriner kliniği": ['["amenity"="veterinary"]'],
  "Emlak danışmanı": ['["office"="estate_agent"]'],
  "Mimarlık ofisi": ['["office"="architect"]'],
  Fotoğrafçı: ['["craft"="photographer"]', '["shop"="photo"]'],
  "Düğün salonu": ['["amenity"="events_venue"]', text("düğün salonu|nikah salonu|event|davet")],
  "Spor salonu": ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]["sport"="fitness"]'],
  Anaokulu: ['["amenity"="kindergarten"]'],
  "Özel eğitim kursu": ['["office"="educational_institution"]', '["amenity"="training"]', '["amenity"="language_school"]', text("özel eğitim|eğitim|kurs|akademi")],
  Matbaa: ['["craft"="printer"]', '["shop"="copyshop"]', text("matbaa|baskı")],
  Çiçekçi: ['["shop"="florist"]'],
  Pastane: ['["shop"="pastry"]', '["shop"="bakery"]'],
  Mobilyacı: ['["shop"="furniture"]'],
  Elektrikçi: ['["craft"="electrician"]'],
  Tesisatçı: ['["craft"="plumber"]'],
  "Kombi servisi": ['["craft"="heating_engineer"]', text("kombi|ısıtma|doğalgaz servis")],
  Nakliyat: ['["office"="moving_company"]', text("nakliyat|evden eve")],
  Transfer: ['["office"="logistics"]', text("transfer|taşımacılık")],
  "Araç kiralama": ['["amenity"="car_rental"]', '["shop"="car_rental"]'],
  "Gıda toptancısı": [text("gıda.*toptan|toptan.*gıda|erzak|gıda dağıtım")],
  "İçecek toptancısı": ['["shop"="beverages"]', text("içecek.*toptan|toptan.*içecek|meşrubat")],
  "Temizlik malzemeleri toptancısı": [text("temizlik.*(toptan|malzeme)|deterjan")],
  "Ambalaj malzemeleri toptancısı": ['["shop"="packaging"]', text("ambalaj|paketleme")],
  "Oto yedek parça toptancısı": ['["shop"="car_parts"]', text("yedek parça.*toptan|toptan.*yedek parça")],
  "Hırdavat toptancısı": ['["shop"="hardware"]'],
  "Yapı malzemeleri toptancısı": ['["shop"="trade"]', text("yapı malzeme|inşaat malzeme")],
  "Elektrik malzemeleri toptancısı": ['["shop"="electrical"]', text("elektrik malzeme")],
  "Tekstil toptancısı": ['["shop"="fabric"]', text("tekstil|kumaş")],
  "Kırtasiye toptancısı": ['["shop"="stationery"]', text("kırtasiye.*toptan|toptan.*kırtasiye")],
  "Medikal malzeme tedarikçisi": ['["shop"="medical_supply"]', text("medikal|tıbbi malzeme")],
  "Endüstriyel malzeme tedarikçisi": [text("endüstriyel|sanayi malzeme|sanayi tedarik")],
  "Mobilya üreticisi": ['["craft"="cabinet_maker"]', '["industrial"="furniture"]', text("mobilya.*(üretim|imalat|fabrika)")],
  "Plastik ürün üreticisi": ['["industrial"="plastics"]', text("plastik.*(üretim|imalat|fabrika)")],
  "Yem bayisi": ['["shop"="agrarian"]', text("yem bay|yem satış")],
  "Tarım ürünleri toptancısı": ['["shop"="agrarian"]', text("tarım|ziraat")],
  Toptancı: ['["shop"="wholesale"]', text("toptan")],
  "Dağıtım firması": ['["office"="logistics"]', text("dağıtım|lojistik")],
} satisfies Record<SearchableSector, readonly string[]>;

export function selectorsForSector(sector: string): readonly string[] {
  return SECTOR_SELECTORS[sector as SearchableSector] ?? [text(escapeRegex(sector))];
}

export function sectorQueryPlan(sector: string) {
  const selectors = selectorsForSector(sector);
  return {
    overpassSelectors: selectors.filter((selector) => !selector.startsWith('["name"~')),
    useTextSearch: selectors.some((selector) => selector.startsWith('["name"~')),
  };
}

function escapeRegex(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
