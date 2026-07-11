export function normalizeTurkishPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.startsWith("05")) digits = `9${digits}`;
  else if (digits.startsWith("5") && digits.length === 10) digits = `90${digits}`;

  if (!/^905\d{9}$/.test(digits)) return null;
  return digits;
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
