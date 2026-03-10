import { describe, expect, it, vi } from "vitest";
import {
  activeFiltersFromSearchParams,
  activeFiltersToSearchParams,
  aggregateTraitSummaryPages,
  computeAvailableFilters,
  computePrecomputedFilters,
  fetchFilteredTraitValues,
  fetchTraitNamesSummary,
  filterTokensByActiveFilters,
  numericTraitValueByName,
  tokenMatchesActiveFilters,
  traitValueByName,
} from "@/lib/marketplace/traits";

describe("marketplace trait utilities", () => {
  it("trait_summary_aggregates_names_across_projects", () => {
    const result = aggregateTraitSummaryPages([
      {
        projectId: "project-a",
        traits: [
          { traitName: "Background", valueCount: 2 },
          { traitName: "Eyes", valueCount: 3 },
        ],
      },
      {
        projectId: "project-b",
        traits: [
          { traitName: "Background", valueCount: 4 },
          { traitName: "Mouth", valueCount: 1 },
        ],
      },
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        { traitName: "Background", valueCount: 6 },
        { traitName: "Eyes", valueCount: 3 },
        { traitName: "Mouth", valueCount: 1 },
      ]),
    );
  });

  it("trait_values_respect_other_active_filters", async () => {
    const fetchTraitValues = vi.fn(async () => ({
      pages: [
        { projectId: "project-a", values: [{ traitValue: "Big", count: 2 }] },
        {
          projectId: "project-b",
          values: [
            { traitValue: "Big", count: 3 },
            { traitValue: "Small", count: 1 },
          ],
        },
      ],
      errors: [],
    }));

    const result = await fetchFilteredTraitValues(
      {
        address: "0xabc",
        traitName: "Eyes",
        projects: ["project-a", "project-b"],
        otherTraitFilters: [{ name: "Background", value: "Blue" }],
      },
      { fetchTraitValues },
    );

    expect(fetchTraitValues).toHaveBeenCalledWith(
      expect.objectContaining({
        otherTraitFilters: [{ name: "Background", value: "Blue" }],
      }),
    );
    expect(result.values).toEqual(
      expect.arrayContaining([
        { traitValue: "Big", count: 5 },
        { traitValue: "Small", count: 1 },
      ]),
    );
  });

  it("available_filters_exclude_invalid_combinations", () => {
    const available = computeAvailableFilters(
      [
        { traitName: "Background", traitValue: "Blue", count: 5 },
        { traitName: "Background", traitValue: "Red", count: 3 },
        { traitName: "Eyes", traitValue: "Big", count: 2 },
        { traitName: "Eyes", traitValue: "Small", count: 6 },
      ],
      {
        Background: new Set(["Blue"]),
      },
    );

    expect(available.Background.Blue).toBe(5);
    expect(available.Background.Red).toBeUndefined();
    expect(available.Eyes.Big).toBe(2);
    expect(available.Eyes.Small).toBe(6);
  });

  it("precomputed_filters_sort_and_count_are_stable", () => {
    const available = {
      Background: { Blue: 5, Red: 3 },
      Eyes: { Small: 6, Big: 2 },
    };

    const first = computePrecomputedFilters(available);
    const second = computePrecomputedFilters(available);

    expect(first).toEqual(second);
    expect(first.properties.Eyes[0]).toEqual({
      property: "Small",
      order: 0,
      count: 6,
    });
  });

  it("flatten_active_filters_round_trips_with_url_params", () => {
    const filters = {
      Background: new Set(["Blue", "Red"]),
      Eyes: new Set(["Big"]),
    };

    const params = activeFiltersToSearchParams(filters);
    const roundTripped = activeFiltersFromSearchParams(params);

    expect(Array.from(roundTripped.Background).sort()).toEqual(["Blue", "Red"]);
    expect(Array.from(roundTripped.Eyes).sort()).toEqual(["Big"]);
  });

  it("trait_names_summary_calls_fetcher_and_aggregates", async () => {
    const fetcher = vi.fn(async () => ({
      pages: [
        {
          projectId: "project-a",
          traits: [
            { traitName: "Background", valueCount: 2 },
            { traitName: "Eyes", valueCount: 3 },
          ],
        },
        {
          projectId: "project-b",
          traits: [
            { traitName: "Background", valueCount: 4 },
            { traitName: "Mouth", valueCount: 1 },
          ],
        },
      ],
      errors: [],
    }));

    const result = await fetchTraitNamesSummary(
      { address: "0xabc", projects: ["project-a", "project-b"] },
      { fetchTraitNamesSummary: fetcher },
    );

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ address: "0xabc" }),
    );
    expect(result.traitNames).toEqual([
      { traitName: "Background", valueCount: 6 },
      { traitName: "Eyes", valueCount: 3 },
      { traitName: "Mouth", valueCount: 1 },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("token_matches_filters_and_batch_filter_are_consistent", () => {
    const filters = { Background: new Set(["Blue"]) };
    const tokens = [
      {
        token_id: "1",
        metadata: {
          attributes: [
            { trait_type: "Background", value: "Blue" },
            { trait_type: "Eyes", value: "Big" },
          ],
        },
      },
      {
        token_id: "2",
        metadata: {
          attributes: [
            { trait_type: "Background", value: "Red" },
            { trait_type: "Eyes", value: "Big" },
          ],
        },
      },
    ];

    const bySingle = tokens.filter((item) => tokenMatchesActiveFilters(item, filters));
    const byBatch = filterTokensByActiveFilters(tokens, filters);

    expect(byBatch.map((item) => item.token_id)).toEqual(
      bySingle.map((item) => item.token_id),
    );
  });

  it("reads_trait_values_from_mixed_metadata_shapes", () => {
    const metadata = {
      attributes: [
        { traitName: "Power", traitValue: "99" },
        { name: "Health", value: "88" },
      ],
    };

    expect(traitValueByName(metadata, "Power")).toBe("99");
    expect(traitValueByName(metadata, "Health")).toBe("88");
  });

  it("parses_numeric_trait_values_and_rejects_invalid_numbers", () => {
    const metadata = {
      attributes: [
        { trait_type: "Level", value: "42" },
        { trait_type: "Rank", value: "legendary" },
      ],
    };

    expect(numericTraitValueByName(metadata, "Level")).toBe(42);
    expect(numericTraitValueByName(metadata, "Rank")).toBeNull();
    expect(numericTraitValueByName(metadata, "Health")).toBeNull();
  });
});
