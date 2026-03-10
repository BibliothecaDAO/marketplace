import { beforeEach, describe, expect, it } from "vitest";
import { _resetConfigCache } from "@/lib/marketplace/config";
import { getCollectionFilterConfig } from "@/lib/marketplace/collection-filter-config";

describe("collection filter config", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MARKETPLACE_COLLECTIONS =
      "0xrealm|Realms|project-realms,0xbeast|Beasts|project-beasts";
    _resetConfigCache();
  });

  it("returns_default_config_for_unknown_collections", () => {
    expect(getCollectionFilterConfig("0xunknown")).toEqual({
      hiddenTraits: [],
      overrides: {},
    });
  });

  it("resolves_market_activity_config_from_runtime_collection_name", () => {
    expect(getCollectionFilterConfig("0xrealm").marketActivity).toEqual({
      details: [
        {
          mode: "all",
          traitNames: ["Resource"],
        },
      ],
    });

    expect(getCollectionFilterConfig("0xbeast").marketActivity).toEqual({
      details: [
        {
          label: "Type",
          traitNames: ["Type", "Beast"],
        },
        {
          label: "Level",
          traitNames: ["Level"],
        },
      ],
    });
  });
});
