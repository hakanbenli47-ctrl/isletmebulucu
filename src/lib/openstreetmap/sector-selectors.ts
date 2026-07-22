import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "../../data/sectors";

export type SearchableSector = (typeof WEBSITE_SECTORS)[number] | (typeof ACCOUNTING_SECTORS)[number];

const text = (pattern: string) => `["name"~"${pattern}",i]`;

// Her ürün sektörü kendi OSM etiketleriyle ayrı sorgulanır. Yapısal etiketin Türkiye'de
// seyrek kullanıldığı alanlarda hızlı ve indekslenebilir işletme adı yedeği de bulunur.
export const SECTOR_SELECTORS = {
  Kuaför: ['["shop"="hairdresser"]'],
  "Güzellik merkezi": ['["shop"="beauty"]', text("güzellik merkezi|güzellik salonu|beauty")],
  Berber: ['["shop"="hairdresser"]["hairdresser"="male"]', text("berber")],
  Nakliyat: ['["office"="moving_company"]', text("nakliyat|evden eve")],
  "Oto yıkama": ['["amenity"="car_wash"]'],
  "Halı yıkama": ['["shop"="laundry"]', text("halı yıkama|halı temizleme")],
  "Tırnak salonu": ['["shop"="beauty"]["beauty"="nails"]', text("tırnak|nail")],
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
