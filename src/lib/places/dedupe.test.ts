import { describe, expect, it } from "vitest";
import { filterNewPlaceIds } from "./dedupe";

describe("filterNewPlaceIds", () => {
  it("veritabanındaki ve aynı yanıttaki tekrarları çıkarır", () => {
    const result = filterNewPlaceIds([{ placeId: "a" }, { placeId: "b" }, { placeId: "b" }, { placeId: "c" }], ["a"]);
    expect(result).toEqual([{ placeId: "b" }, { placeId: "c" }]);
  });
});


