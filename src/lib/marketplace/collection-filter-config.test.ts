import { describe, expect, it } from "vitest";
import { getCollectionFilterConfig } from "@/lib/marketplace/collection-filter-config";

describe("collection filter config", () => {
  it("returns_default_config_for_unknown_collections", () => {
    expect(getCollectionFilterConfig("0xunknown")).toEqual({
      hiddenTraits: [],
      overrides: {},
    });
  });
});
