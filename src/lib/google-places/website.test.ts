import { describe, expect, it } from "vitest";
import { isIndependentWebsite } from "./website";

describe("isIndependentWebsite", () => {
  it.each([null, "", "https://instagram.com/ornek", "https://www.facebook.com/ornek", "https://linktr.ee/ornek", "https://x.com/ornek"])('sosyal veya boş "%s" için false döner', (uri) => {
    expect(isIndependentWebsite(uri)).toBe(false);
  });

  it("bağımsız alan adını kabul eder", () => {
    expect(isIndependentWebsite("https://ornekisletme.com.tr")).toBe(true);
  });
});
