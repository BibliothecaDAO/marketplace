import { describe, expect, it } from "vitest";
import { resolveMarketActivityDetails } from "@/lib/marketplace/market-activity-details";

describe("market activity details", () => {
  it("deduplicates_all_matching_trait_values", () => {
    const details = resolveMarketActivityDetails(
      {
        metadata: {
          attributes: [
            { trait_type: "Resource", value: "Wood" },
            { trait_type: "Resource", value: "Stone" },
            { traitName: "Resource", traitValue: "Wood" },
          ],
        },
      },
      { details: [{ traitNames: ["Resource"], mode: "all" }] },
    );

    expect(details).toEqual([
      { label: null, value: "Wood" },
      { label: null, value: "Stone" },
    ]);
  });

  it("uses_the_first_matching_trait_alias_for_single_value_details", () => {
    const details = resolveMarketActivityDetails(
      {
        metadata: {
          attributes: [
            { name: "Beast", value: "Phoenix" },
            { trait_type: "Level", value: 12 },
          ],
        },
      },
      {
        details: [
          { label: "Type", traitNames: ["Type", "Beast"] },
          { label: "Level", traitNames: ["Level"] },
        ],
      },
    );

    expect(details).toEqual([
      { label: "Type", value: "Phoenix" },
      { label: "Level", value: "12" },
    ]);
  });
});
