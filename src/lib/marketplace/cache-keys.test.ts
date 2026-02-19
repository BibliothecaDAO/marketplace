import { describe, expect, it } from "vitest";
import {
  normalizeAttributeFilters,
  normalizeTokenIds,
  stableCacheKey,
} from "@/lib/marketplace/cache-keys";

describe("marketplace cache keys", () => {
  it("normalizes token id arrays deterministically", () => {
    expect(normalizeTokenIds(["7", "0xabc", "7", "2"])).toEqual(["0xabc", "2", "7"]);
  });

  it("normalizes attribute filters deterministically", () => {
    const actual = normalizeAttributeFilters({
      Background: ["Blue", "Blue", "Red"],
      Eyes: new Set(["Laser", "Normal"]),
    });

    expect(actual).toEqual({
      Background: ["Blue", "Red"],
      Eyes: ["Laser", "Normal"],
    });
  });

  it("creates the same key for semantically equivalent objects", () => {
    const a = stableCacheKey({
      address: "0xabc",
      tokenIds: ["2", "1"],
      attributeFilters: { B: ["2", "1"], A: ["3"] },
    });
    const b = stableCacheKey({
      attributeFilters: { A: ["3"], B: ["1", "2"] },
      tokenIds: ["1", "2"],
      address: "0xabc",
    });

    expect(a).toBe(b);
  });
});
