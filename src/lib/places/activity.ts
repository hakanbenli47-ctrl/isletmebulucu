export function isOpenedWithinLastTwoYears(value: string | null | undefined, now = new Date()) {
  return openingRecencyStatus(value, now) === "recent";
}

export function openingRecencyStatus(
  value: string | null | undefined,
  now = new Date(),
): "recent" | "old" | "unknown" {
  const opened = parseConservativeOpeningDate(value);
  if (!opened || opened.getTime() > now.getTime()) return "unknown";
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  cutoff.setUTCHours(0, 0, 0, 0);
  const timestamp = opened.getTime();
  return timestamp >= cutoff.getTime() ? "recent" : "old";
}

export function parseConservativeOpeningDate(value: string | null | undefined) {
  const clean = value?.trim().replace(/^~/, "");
  if (!clean) return null;

  let normalized: string;
  if (/^\d{4}$/.test(clean)) normalized = `${clean}-01-01`;
  else if (/^\d{4}-(0[1-9]|1[0-2])$/.test(clean)) normalized = `${clean}-01`;
  else if (/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(clean)) normalized = clean;
  else return null;

  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
