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

  it("resolves_realms_resource_config_from_collection_name", () => {
    const result = getCollectionFilterConfig("0xrealm5", [
      {
        address: "0xrealm5",
        name: "Realms",
        projectId: "project-realms",
      },
    ]);

    expect(result.overrides.Resource).toEqual({
      type: "pills",
      sort: "alpha",
      hideSearch: true,
    });
    expect(result.sortOptions).toEqual([
      {
        label: "Recent",
        values: { asc: "recent", desc: "recent" },
        defaultDirection: "asc",
      },
      {
        label: "Price",
        values: { asc: "price-asc", desc: "price-desc" },
        defaultDirection: "asc",
      },
      {
        label: "Resources",
        values: {
          asc: "resource-count-asc",
          desc: "resource-count-desc",
        },
        defaultDirection: "desc",
      },
    ]);
    expect(result.showInlineResources).toBe(true);
  });
});
