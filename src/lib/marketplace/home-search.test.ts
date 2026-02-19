import { describe, expect, it } from "vitest";
import {
  matchesHomeSearch,
  normalizeHomeSearchQuery,
} from "@/lib/marketplace/home-search";

describe("home search helpers", () => {
  it("normalizes_case_whitespace_and_spacing", () => {
    expect(normalizeHomeSearchQuery("  Loot   Chests  ")).toBe("loot chests");
  });

  it("matches_against_any_search_field", () => {
    expect(
      matchesHomeSearch("  2357 ", ["Genesis Collection", "Loot Chest #2357"]),
    ).toBe(true);
    expect(matchesHomeSearch("genesis", ["Artifacts", "Token #77"])).toBe(false);
  });

  it("treats_empty_query_as_match", () => {
    expect(matchesHomeSearch("   ", ["Anything"])).toBe(true);
  });
});
