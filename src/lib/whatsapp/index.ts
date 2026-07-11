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
