import { describe, expect, it } from "vitest";
import { activeFiltersFromSearchParams } from "@/lib/marketplace/traits";
import {
  collectionDiscoveryStateFromSearchParams,
  collectionDiscoveryStateToSearchParams,
  sortModeFromSearchParams,
} from "@/features/collections/collection-query-params";

describe("collection query params", () => {
  it("parses_sort_mode_with_price_asc_as_default", () => {
    expect(sortModeFromSearchParams(new URLSearchParams("sort=price-asc"))).toBe("price-asc");
    expect(sortModeFromSearchParams(new URLSearchParams("sort=unknown"))).toBe("price-asc");
    expect(sortModeFromSearchParams(new URLSearchParams())).toBe("price-asc");
  });

  it("serializes_filters_and_sort_and_resets_cursor", () => {
    const params = collectionDiscoveryStateToSearchParams(
      new URLSearchParams("cursor=page-2&foo=bar&trait=Eyes:Big"),
      {
        activeFilters: {
          Background: new Set(["Blue"]),
        },
        sortMode: "price-desc",
      },
    );

    expect(params.get("cursor")).toBeNull();
    expect(params.get("foo")).toBe("bar");
    expect(params.get("sort")).toBe("price-desc");
    expect(activeFiltersFromSearchParams(params)).toEqual({
      Background: new Set(["Blue"]),
    });
  });

  it("omits_sort_param_when_sort_mode_is_price_asc", () => {
    const params = collectionDiscoveryStateToSearchParams(
      new URLSearchParams("sort=price-asc"),
      {
        activeFilters: {},
        sortMode: "price-asc",
      },
    );

    expect(params.get("sort")).toBeNull();
  });

  it("parses_combined_discovery_state_from_query", () => {
    const state = collectionDiscoveryStateFromSearchParams(
      new URLSearchParams("trait=Eyes:Big&sort=price-desc"),
    );

    expect(Array.from(state.activeFilters.Eyes)).toEqual(["Big"]);
    expect(state.sortMode).toBe("price-desc");
  });
});
