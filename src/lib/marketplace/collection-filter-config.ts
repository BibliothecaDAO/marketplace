import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import type { MarketActivityConfig } from "@/lib/marketplace/market-activity-details";

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
  marketActivity?: MarketActivityConfig;
};

const DEFAULT_COLLECTION_FILTER_CONFIG: CollectionFilterConfig = {
  hiddenTraits: [],
  overrides: {},
};

const COLLECTION_FILTER_CONFIGS: Record<string, CollectionFilterConfig> = {};
const COLLECTION_FILTER_CONFIGS_BY_NAME: Record<string, CollectionFilterConfig> = {
  beasts: {
    hiddenTraits: [],
    overrides: {},
    marketActivity: {
      details: [
        {
          label: "Type",
          traitNames: ["Type", "Beast"],
        },
        {
          label: "Level",
          traitNames: ["Level"],
        },
      ],
    },
  },
  realms: {
    hiddenTraits: [],
    overrides: {},
    marketActivity: {
      details: [
        {
          mode: "all",
          traitNames: ["Resource"],
        },
      ],
    },
  },
};

function collectionConfigByName(name: string | undefined) {
  if (!name) {
    return undefined;
  }

  return COLLECTION_FILTER_CONFIGS_BY_NAME[name.trim().toLowerCase()];
}

export function getCollectionFilterConfig(address: string): CollectionFilterConfig {
  const normalizedAddress = address.toLowerCase();
  const directConfig = COLLECTION_FILTER_CONFIGS[normalizedAddress];
  if (directConfig) {
    return directConfig;
  }

  const runtimeCollection = getMarketplaceRuntimeConfig().collections.find(
    (collection) => collection.address.toLowerCase() === normalizedAddress,
  );

  return (
    collectionConfigByName(runtimeCollection?.name) ??
    DEFAULT_COLLECTION_FILTER_CONFIG
  );
}
