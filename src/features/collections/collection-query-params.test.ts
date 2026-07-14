import { describe, expect, it } from "vitest";
import { activeFiltersFromSearchParams } from "@/lib/marketplace/traits";
import {
  collectionDiscoveryStateFromSearchParams,
  collectionDiscoveryStateToSearchParams,
  currencyFromSearchParams,
  sortModeFromSearchParams,
} from "@/features/collections/collection-query-params";

describe("collection query params", () => {
  it("parses_sort_mode_with_price_asc_as_default", () => {
    expect(sortModeFromSearchParams(new URLSearchParams("sort=price-asc"))).toBe("price-asc");
    expect(sortModeFromSearchParams(new URLSearchParams("sort=power-desc"))).toBe("power-desc");
    expect(sortModeFromSearchParams(new URLSearchParams("sort=resource-count-desc"))).toBe("resource-count-desc");
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
        currency: "LORDS",
      },
    );

    expect(params.get("cursor")).toBeNull();
    expect(params.get("foo")).toBe("bar");
    expect(params.get("sort")).toBe("price-desc");
    expect(params.get("currency")).toBe("LORDS");
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
        currency: "STRK",
      },
    );

    expect(params.get("sort")).toBeNull();
    expect(params.get("currency")).toBeNull();
  });

  it("parses_combined_discovery_state_from_query", () => {
    const state = collectionDiscoveryStateFromSearchParams(
      new URLSearchParams("trait=Eyes:Big&sort=price-desc&currency=SURVIVO"),
    );

    expect(Array.from(state.activeFilters.Eyes)).toEqual(["Big"]);
    expect(state.sortMode).toBe("price-desc");
    expect(state.currency).toBe("SURVIVO");
  });

  it("defaults currency to STRK and rejects unknown symbols", () => {
    expect(currencyFromSearchParams(new URLSearchParams())).toBe("STRK");
    expect(currencyFromSearchParams(new URLSearchParams("currency=lords"))).toBe("LORDS");
    expect(currencyFromSearchParams(new URLSearchParams("currency=ETH"))).toBe("STRK");
  });
});
