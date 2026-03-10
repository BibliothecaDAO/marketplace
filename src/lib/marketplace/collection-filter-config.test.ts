import { beforeEach, describe, expect, it } from "vitest";
import { getCollectionFilterConfig } from "@/lib/marketplace/collection-filter-config";
import { _resetConfigCache } from "@/lib/marketplace/config";

describe("collection filter config", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS;
    _resetConfigCache();
  });

  it("returns_default_config_for_unknown_collections", () => {
    expect(getCollectionFilterConfig("0xunknown")).toEqual({
      hiddenTraits: [],
      overrides: {},
    });
  });

  it("resolves_adventurers_curation_from_runtime_collections", () => {
    process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS = "0xadv|Adventurers";
    _resetConfigCache();

    expect(getCollectionFilterConfig("0xadv")).toEqual({
      hiddenTraits: ["Token ID", "Adventurer ID"],
      overrides: {},
    });
  });

  it("resolves_loot_chests_filter_config_from_runtime_collections", () => {
    process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS = "0xchest|Loot Chests";
    _resetConfigCache();

    expect(getCollectionFilterConfig("0xchest")).toEqual({
      hiddenTraits: [],
      overrides: {
        Source: { type: "pills", sort: "alpha" },
        Tier: { type: "pills", sort: "alpha" },
      },
    });
  });
});
