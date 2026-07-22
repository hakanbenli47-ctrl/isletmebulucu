import { describe, expect, it } from "vitest";
import { buildOverpassSearchQuery } from "./query";

describe("hızlı Overpass sorgusu", () => {
  it("regex anahtar taraması yerine indekslenebilir telefon anahtarları üretir", () => {
    const query = buildOverpassSearchQuery(
      'area["ISO3166-2"="TR-34"]->.searchArea;',
      ['["shop"="hairdresser"]'],
      250,
    );
    expect(query).toContain('nwr["contact:phone"]["shop"="hairdresser"](area.searchArea);');
    expect(query).toContain('nwr["whatsapp"]["shop"="hairdresser"](area.searchArea);');
    expect(query).not.toContain('[~"^(contact:)?');
    expect(query).toContain("out center 250;");
  });

  it("sektör adı yedeğini aynı ücretsiz Overpass sorgusunda tutar", () => {
    const query = buildOverpassSearchQuery(
      'area["ISO3166-2"="TR-06"]->.searchArea;',
      ['["name"~"tırnak|nail",i]'],
      100,
    );
    expect(query).toContain('["contact:mobile"]["name"~"tırnak|nail",i]');
  });
});
