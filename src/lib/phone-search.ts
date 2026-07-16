export function normalizePhoneSearch(value: string | null | undefined) {
  if (!value) return null;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = `90${digits.slice(1)}`;
  else if (digits.startsWith("5") && digits.length === 10) digits = `90${digits}`;

  return /^90\d{10}$/.test(digits) ? digits : null;
}

export function phoneMatchesSearch(
  search: string | null | undefined,
  candidate: string | null | undefined,
) {
  const normalizedSearch = normalizePhoneSearch(search);
  const normalizedCandidate = normalizePhoneSearch(candidate);
  return Boolean(
    normalizedSearch &&
      normalizedCandidate &&
      normalizedSearch === normalizedCandidate,
  );
}

export function formatPhoneSearch(value: string | null | undefined) {
  const normalized = normalizePhoneSearch(value);
  if (!normalized) return value?.trim() ?? "";

  const local = `0${normalized.slice(2)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9, 11)}`;
}
