export type PillsFilterOverride = {
  type: "pills";
  showCount?: boolean;
  sort?: "alpha" | "count";
  hideSearch?: boolean;
};

export type BooleanFilterOverride = {
  type: "boolean";
};

export type RangeFilterOverride = {
  type: "range";
  min: number;
  max: number;
};

export type FilterOverride =
  | BooleanFilterOverride
  | RangeFilterOverride
  | PillsFilterOverride;

export type CollectionFilterConfig = {
  hiddenTraits: string[];
  overrides: Record<string, FilterOverride>;
  sortOptions?: Array<{ label: string; value: string }>;
};

const DEFAULT_COLLECTION_FILTER_CONFIG: CollectionFilterConfig = {
  hiddenTraits: [],
  overrides: {},
};

const COLLECTION_FILTER_CONFIGS: Record<string, CollectionFilterConfig> = {};

export function getCollectionFilterConfig(address: string): CollectionFilterConfig {
  return COLLECTION_FILTER_CONFIGS[address.toLowerCase()] ?? DEFAULT_COLLECTION_FILTER_CONFIG;
}
