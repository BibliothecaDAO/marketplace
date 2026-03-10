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
    expect(result.overrides.Animated).toEqual({ type: "boolean" });
    expect(result.overrides.Health).toEqual({ type: "range", min: 1, max: 1023 });
    expect(result.marketActivity).toEqual({
      details: [
        { label: "Type", traitNames: ["Type", "Beast"] },
        { label: "Level", traitNames: ["Level"] },
      ],
    });
  });

  it("resolves_adventurers_curation_from_collection_name", () => {
    const result = getCollectionFilterConfig("0xadv", [
      {
        address: "0xadv",
        name: "Adventurers",
        projectId: "project-adv",
      },
    ]);

    expect(result.hiddenTraits).toEqual([
      "Token ID",
      "Adventurer ID",
      "XP",
      "Entropy",
    ]);
    expect(result.overrides.Health).toEqual({ type: "range", min: 1, max: 255 });
    expect(result.overrides.Level).toEqual({ type: "range", min: 1, max: 100 });
  });

  it("resolves_loot_chest_filters_from_collection_name", () => {
    const result = getCollectionFilterConfig("0xchest", [
      {
        address: "0xchest",
        name: "Loot Chests",
        projectId: "project-chests",
      },
    ]);

    expect(result.overrides.Source).toEqual({ type: "pills", sort: "alpha" });
    expect(result.overrides.Tier).toEqual({ type: "pills", sort: "alpha" });
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
    expect(result.marketActivity).toEqual({
      details: [{ traitNames: ["Resource"], mode: "all" }],
      renderResourcesAsIcons: true,
    });
  });
});
