import { describe, expect, it } from "vitest";
import {
  realmResourceCount,
  realmResources,
  tokenAttributes,
  traitValues,
} from "@/lib/marketplace/token-attributes";

describe("token attribute helpers", () => {
  it("groups_duplicate_attributes_for_overlay_display", () => {
    const metadata = {
      attributes: [
        { trait_type: "Resource", value: "Coal" },
        { trait_type: "Resource", value: "Stone" },
        { trait_type: "Resource", value: "Coal" },
        { trait_type: "Order", value: "North" },
      ],
    };

    expect(tokenAttributes(metadata)).toEqual([
      { trait: "Resource", value: "Coal, Stone" },
      { trait: "Order", value: "North" },
    ]);
  });

  it("extracts_unique_trait_values_from_mixed_attribute_shapes", () => {
    const metadata = {
      attributes: [
        { traitName: "Resource", traitValue: "Wood" },
        { name: "Resource", value: "Stone" },
        { trait_type: "Resource", value: "Wood" },
      ],
    };

    expect(traitValues(metadata, "Resource")).toEqual(["Wood", "Stone"]);
  });

  it("orders_realm_resources_with_known_resources_first", () => {
    const metadata = {
      attributes: [
        { trait_type: "Resource", value: "Wood" },
        { trait_type: "Resource", value: "Silver" },
        { trait_type: "Resource", value: "Amber" },
        { trait_type: "Resource", value: "Coal" },
      ],
    };

    expect(realmResources(metadata)).toEqual(["Coal", "Silver", "Wood", "Amber"]);
    expect(realmResourceCount(metadata)).toBe(4);
  });
});

