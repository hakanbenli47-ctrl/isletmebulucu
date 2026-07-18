// BTK Genel Numaralandırma Planı (20.01.2026): bireysel mobil bloklar.
// 512 çağrı hizmeti, 57X M2M, 592 GMPCS ve 594 GSM-R olduğu için aday telefonu değildir.
const TURKISH_MOBILE_PREFIX = /^(?:50[1567]|510|516|53\d|54\d|55[123459]|561)$/;
const PHONE_LIKE = /(?:\+?90[\s().-]*|0[\s().-]*)?5(?:[\s().-]*\d){9}/g;

export function normalizeTurkishPhone(value: string | null | undefined): string | null {
  return extractTurkishMobilePhones(value)[0] ?? null;
}

export function extractTurkishMobilePhones(value: string | null | undefined): string[] {
  if (!value) return [];
  const decoded = safelyDecode(value);
  const candidates = [decoded, ...(decoded.match(PHONE_LIKE) ?? [])];
  const normalized = candidates.flatMap((candidate) => {
    let digits = candidate.replace(/\D/g, "");
    if (digits.startsWith("0090")) digits = digits.slice(2);
    if (/^9005\d{9}$/.test(digits)) digits = `90${digits.slice(3)}`;
    if (digits.startsWith("05") && digits.length === 11) digits = `9${digits}`;
    else if (digits.startsWith("5") && digits.length === 10) digits = `90${digits}`;
    if (!/^905\d{9}$/.test(digits)) return [];
    return TURKISH_MOBILE_PREFIX.test(digits.slice(2, 5)) ? [digits] : [];
  });
  return [...new Set(normalized)];
}

export function formatTurkishMobilePhone(value: string | null | undefined): string | null {
  const normalized = normalizeTurkishPhone(value);
  if (!normalized) return null;
  const local = `0${normalized.slice(2)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9, 11)}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const normalized = normalizeTurkishPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppDesktopUrl(phone: string, message: string): string | null {
  const normalized = normalizeTurkishPhone(phone);
  if (!normalized) return null;
  return `whatsapp://send?phone=${normalized}&text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppWebUrl(phone: string, message: string): string | null {
  const normalized = normalizeTurkishPhone(phone);
  if (!normalized) return null;
  return `https://web.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;
}

export function personalizeWhatsAppMessage(message: string, businessName: string): string {
  const safeName = businessName
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!safeName) return message;

  const greeting = `Merhaba, ${safeName} yetkilisi. İyi çalışmalar.`;
  const cleanMessage = message.trim();
  const defaultGreeting = /^Merhaba,\s*iyi çalışmalar\.\s*/i;

  if (defaultGreeting.test(cleanMessage)) {
    return cleanMessage.replace(defaultGreeting, `${greeting}\n\n`);
  }
  return `${greeting}\n\n${cleanMessage}`;
}

function safelyDecode(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, "%2B"));
  } catch {
    return value;
  }
}
