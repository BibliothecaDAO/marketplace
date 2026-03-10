import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

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

const COLLECTION_NAME_CONFIGS: Record<string, CollectionFilterConfig> = {
  adventurers: {
    hiddenTraits: ["Token ID", "Adventurer ID"],
    overrides: {},
  },
};

function normalizeAddress(address: string) {
  try {
    return `0x${BigInt(address).toString(16)}`;
  } catch {
    return address.toLowerCase();
  }
}

function normalizeCollectionName(name: string) {
  return name.trim().toLowerCase();
}

export function getCollectionFilterConfig(address: string): CollectionFilterConfig {
  const normalizedAddress = normalizeAddress(address);
  const directConfig = COLLECTION_FILTER_CONFIGS[normalizedAddress];
  if (directConfig) {
    return directConfig;
  }

  const runtimeCollection = getMarketplaceRuntimeConfig().collections.find(
    (collection) => normalizeAddress(collection.address) === normalizedAddress,
  );
  if (!runtimeCollection) {
    return DEFAULT_COLLECTION_FILTER_CONFIG;
  }

  return COLLECTION_NAME_CONFIGS[normalizeCollectionName(runtimeCollection.name)]
    ?? DEFAULT_COLLECTION_FILTER_CONFIG;
}
