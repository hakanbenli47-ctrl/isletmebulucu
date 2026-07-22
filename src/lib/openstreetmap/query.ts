const CONTACT_TAG_KEYS = [
  "contact:whatsapp", "whatsapp", "contact:mobile", "mobile",
  "contact:phone", "phone", "contact:telephone", "telephone",
  "contact:cell", "cell", "contact:gsm", "gsm",
] as const;

export function buildOverpassSearchQuery(
  areaSelector: string,
  selectors: readonly string[],
  resultLimit: number,
) {
  const searches = selectors.flatMap((selector) =>
    CONTACT_TAG_KEYS.map((key) => `nwr["${key}"]${selector}(area.searchArea);`),
  );
  return [
    "[out:json][timeout:6];",
    areaSelector,
    "(",
    ...searches,
    ");",
    `out center ${resultLimit};`,
  ].join("\n");
}
