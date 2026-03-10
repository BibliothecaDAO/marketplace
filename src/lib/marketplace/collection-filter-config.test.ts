import { describe, expect, it } from "vitest";
import { getCollectionFilterConfig } from "@/lib/marketplace/collection-filter-config";

describe("collection filter config", () => {
  it("returns_default_config_for_unknown_collections", () => {
    expect(getCollectionFilterConfig("0xunknown")).toEqual({
      hiddenTraits: [],
      overrides: {},
    });
  });

  it("resolves_beasts_sort_options_from_collection_name", () => {
    const result = getCollectionFilterConfig("0xbeast", [
      {
        address: "0xbeast",
        name: "Beasts",
        projectId: "project-beasts",
      },
    ]);

    expect(result.sortOptions).toEqual([
      {
        label: "Price",
        values: { asc: "price-asc", desc: "price-desc" },
        defaultDirection: "asc",
      },
      {
        label: "Power",
        values: { asc: "power-asc", desc: "power-desc" },
        defaultDirection: "desc",
      },
      {
        label: "Level",
        values: { asc: "level-asc", desc: "level-desc" },
        defaultDirection: "desc",
      },
      {
        label: "Health",
        values: { asc: "health-asc", desc: "health-desc" },
        defaultDirection: "desc",
      },
    ]);
  });
});
