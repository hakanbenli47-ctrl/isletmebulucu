import { normalizePhoneSearch } from "../phone-search";
import { extractTurkishMobilePhones } from "../whatsapp";
import type { PlaceDetails } from "../../types";

const WHATSAPP_KEYS = ["contact:whatsapp", "whatsapp"] as const;
const PHONE_KEYS = [
  "contact:mobile", "mobile", "contact:phone", "phone", "contact:telephone",
  "telephone", "contact:cell", "cell", "contact:gsm", "gsm",
] as const;

export interface OsmContact {
  rawPhone: string | null;
  mobile: string | null;
  fallbackPhone: string | null;
  whatsappEvidence: PlaceDetails["whatsappEvidence"];
  whatsappReason: string;
}

export function contactFromOsmTags(tags: Record<string, string>): OsmContact {
  const whatsappValues = valuesFor(tags, WHATSAPP_KEYS);
  const phoneValues = valuesFor(tags, PHONE_KEYS);
  const whatsappNumbers = whatsappValues.flatMap(extractTurkishMobilePhones);
  const linkedNumbers = Object.values(tags)
    .filter(isWhatsAppLink)
    .flatMap(extractTurkishMobilePhones);
  const phoneNumbers = phoneValues.flatMap(extractTurkishMobilePhones);

  const explicitNumber = whatsappNumbers[0] ?? linkedNumbers[0] ?? null;
  const fallbackMobile = phoneNumbers[0] ?? null;
  const mobile = explicitNumber ?? fallbackMobile;
  const whatsappDeclared = whatsappValues.some(isPositiveWhatsAppValue);
  const evidence = explicitNumber
    ? whatsappNumbers.length ? "explicit_tag" : "explicit_link"
    : whatsappDeclared && fallbackMobile
      ? "explicit_tag"
      : fallbackMobile
        ? "mobile_only"
        : "unverified";
  const rawFallback = firstPhoneValue(phoneValues);

  return {
    rawPhone: mobile ? `+${mobile}` : rawFallback,
    mobile,
    fallbackPhone: rawFallback && normalizePhoneSearch(rawFallback) ? rawFallback : null,
    whatsappEvidence: evidence,
    whatsappReason: evidence === "explicit_tag"
      ? "OpenStreetMap kaydında WhatsApp iletişimi açıkça belirtilmiş"
      : evidence === "explicit_link"
        ? "Açık veri kaydında bu numaraya ait WhatsApp bağlantısı bulunmuş"
        : evidence === "mobile_only"
          ? "BTK numara planına uygun mobil; WhatsApp hesabı henüz canlı doğrulanmadı"
          : "WhatsApp için doğrulanabilir mobil numara bulunamadı",
  };
}

export function isWhatsAppLink(value: string) {
  return /(?:wa\.me\/|api\.whatsapp\.com\/send|whatsapp:\/\/send)/i.test(value);
}

function valuesFor(tags: Record<string, string>, keys: readonly string[]) {
  return keys.flatMap((key) => tags[key] ? splitContactValues(tags[key]) : []);
}

function splitContactValues(value: string) {
  if (isWhatsAppLink(value)) return [value.trim()];
  return value.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
}

function isPositiveWhatsAppValue(value: string) {
  return /^(?:yes|true|available|evet)$/i.test(value.trim());
}

function firstPhoneValue(values: string[]) {
  return values
    .map((item) => item.replace(/\s*(?:ext\.?|dahili|x)\s*\d+$/i, "").trim())
    .find((item) => normalizePhoneSearch(item)) ?? null;
}
