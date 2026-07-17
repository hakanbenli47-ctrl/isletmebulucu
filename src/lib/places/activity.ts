export function isOpenedWithinLastTwoYears(value: string | null | undefined, now = new Date()) {
  const opened = parseConservativeOpeningDate(value);
  if (!opened) return false;
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  cutoff.setUTCHours(0, 0, 0, 0);
  const timestamp = opened.getTime();
  return timestamp <= now.getTime() && timestamp >= cutoff.getTime();
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
