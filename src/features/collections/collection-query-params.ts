import {
  activeFiltersFromSearchParams,
  activeFiltersToSearchParams,
  type ActiveFilters,
} from "@/lib/marketplace/traits";

export type CollectionSortMode =
  | "recent"
  | "price-asc"
  | "price-desc"
  | "power-asc"
  | "power-desc"
  | "level-asc"
  | "level-desc"
  | "health-asc"
  | "health-desc"
  | "resource-count-asc"
  | "resource-count-desc";

const DEFAULT_SORT_MODE: CollectionSortMode = "price-asc";
export type MarketplaceCurrencySymbol = "STRK" | "LORDS" | "SURVIVO";
const DEFAULT_CURRENCY: MarketplaceCurrencySymbol = "STRK";
const CURRENCIES = new Set<MarketplaceCurrencySymbol>(["STRK", "LORDS", "SURVIVO"]);
const SORT_MODES = new Set<CollectionSortMode>([
  "recent",
  "price-asc",
  "price-desc",
  "power-asc",
  "power-desc",
  "level-asc",
  "level-desc",
  "health-asc",
  "health-desc",
  "resource-count-asc",
  "resource-count-desc",
]);

export function sortModeFromSearchParams(params: URLSearchParams): CollectionSortMode {
  const raw = params.get("sort");
  if (raw && SORT_MODES.has(raw as CollectionSortMode)) {
    return raw as CollectionSortMode;
  }

  return DEFAULT_SORT_MODE;
}

export function currencyFromSearchParams(params: URLSearchParams): MarketplaceCurrencySymbol {
  const raw = params.get("currency")?.trim().toUpperCase();
  return raw && CURRENCIES.has(raw as MarketplaceCurrencySymbol)
    ? raw as MarketplaceCurrencySymbol
    : DEFAULT_CURRENCY;
}

export function collectionDiscoveryStateFromSearchParams(params: URLSearchParams) {
  return {
    activeFilters: activeFiltersFromSearchParams(params),
    sortMode: sortModeFromSearchParams(params),
    currency: currencyFromSearchParams(params),
  };
}

export function collectionDiscoveryStateToSearchParams(
  currentParams: URLSearchParams,
  state: {
    activeFilters: ActiveFilters;
    sortMode: CollectionSortMode;
    currency: MarketplaceCurrencySymbol;
  },
) {
  const nextParams = new URLSearchParams(currentParams.toString());
  nextParams.delete("cursor");
  nextParams.delete("trait");
  nextParams.delete("sort");
  nextParams.delete("currency");

  const traitParams = activeFiltersToSearchParams(state.activeFilters);
  traitParams.getAll("trait").forEach((entry) => {
    nextParams.append("trait", entry);
  });

  if (state.sortMode !== DEFAULT_SORT_MODE) {
    nextParams.set("sort", state.sortMode);
  }
  if (state.currency !== DEFAULT_CURRENCY) {
    nextParams.set("currency", state.currency);
  }

  return nextParams;
}
