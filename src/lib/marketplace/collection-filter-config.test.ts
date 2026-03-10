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

  it("resolves_beasts_custom_filter_config_from_runtime_collections", () => {
    process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS = "0xbeast|Beasts";
    _resetConfigCache();

    expect(getCollectionFilterConfig("0xbeast")).toEqual({
      hiddenTraits: [
        "Token ID",
        "Beast ID",
        "Last Death Timestamp",
        "Last Killed By",
        "Adventurers Killed",
      ],
      overrides: {
        Animated: { type: "boolean" },
        Shiny: { type: "boolean" },
        Genesis: { type: "boolean" },
        Beast: { type: "pills", sort: "alpha", showCount: false, hideSearch: true },
        Suffix: { type: "pills", sort: "alpha", showCount: false },
        Prefix: { type: "pills", sort: "alpha", showCount: false },
        Tier: { type: "pills", sort: "alpha", showCount: false, hideSearch: true },
        Type: { type: "pills", sort: "alpha", showCount: false, hideSearch: true },
        Health: { type: "range", min: 1, max: 1023 },
        Level: { type: "range", min: 1, max: 250 },
        Rank: { type: "range", min: 1, max: 1023 },
      },
    });
  });
});
