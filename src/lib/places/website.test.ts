import { describe, expect, it } from "vitest";
import { instagramUsername, isIndependentWebsite, isInstagramProfile, socialProfileType } from "./website";

describe("isIndependentWebsite", () => {
  it.each([null, "", "https://instagram.com/ornek", "https://www.facebook.com/ornek", "https://linktr.ee/ornek", "https://x.com/ornek"])('sosyal veya boş "%s" için false döner', (uri) => {
    expect(isIndependentWebsite(uri)).toBe(false);
  });

  it("bağımsız alan adını kabul eder", () => {
    expect(isIndependentWebsite("https://ornekisletme.com.tr")).toBe(true);
  });

  it("Instagram bağlantısını diğer sosyal profillerden ayırır", () => {
    expect(isInstagramProfile("https://www.instagram.com/ornek/" )).toBe(true);
    expect(isInstagramProfile("instagram.com/ornek")).toBe(true);
    expect(instagramUsername("https://instagram.com/@ornek.isletme/")).toBe("ornek.isletme");
    expect(isInstagramProfile("https://instagram.com/p/ABC123")).toBe(false);
    expect(socialProfileType("https://facebook.com/ornek")).toBe("facebook");
    expect(isInstagramProfile("https://ornekisletme.com.tr")).toBe(false);
  });
});


