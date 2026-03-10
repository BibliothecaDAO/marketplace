import {
  getMarketplaceRuntimeConfig,
  type SeedCollection,
} from "@/lib/marketplace/config";

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
  sortOptions?: CollectionSortOption[];
  showInlineResources?: boolean;
};

export type CollectionSortOption = {
  label: string;
  values: {
    asc: string;
    desc: string;
  };
  defaultDirection?: "asc" | "desc";
};

const DEFAULT_COLLECTION_FILTER_CONFIG: CollectionFilterConfig = {
  hiddenTraits: [],
  overrides: {},
};

const COLLECTION_FILTER_CONFIGS: Record<string, CollectionFilterConfig> = {};

const COLLECTION_NAME_CONFIGS: Record<string, CollectionFilterConfig> = {
  beasts: {
    hiddenTraits: [],
    overrides: {},
    sortOptions: [
      {
        label: "Price",
        values: { asc: "price-asc", desc: "price-desc" },
        defaultDirection: "asc",
      },
      {
        label: "Power",
        values: { asc: "power-asc", desc: "power-desc" },
        defaultDirection: "desc",
      },
      {
        label: "Level",
        values: { asc: "level-asc", desc: "level-desc" },
        defaultDirection: "desc",
      },
      {
        label: "Health",
        values: { asc: "health-asc", desc: "health-desc" },
        defaultDirection: "desc",
      },
    ],
  },
  realms: {
    hiddenTraits: [],
    overrides: {
      Resource: { type: "pills", sort: "alpha", hideSearch: true },
    },
    sortOptions: [
      {
        label: "Recent",
        values: { asc: "recent", desc: "recent" },
        defaultDirection: "asc",
      },
      {
        label: "Price",
        values: { asc: "price-asc", desc: "price-desc" },
        defaultDirection: "asc",
      },
      {
        label: "Resources",
        values: {
          asc: "resource-count-asc",
          desc: "resource-count-desc",
        },
        defaultDirection: "desc",
      },
    ],
    showInlineResources: true,
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

function resolveCollectionByAddress(
  normalizedAddress: string,
  collections?: SeedCollection[],
) {
  const availableCollections =
    collections ?? getMarketplaceRuntimeConfig().collections;

  return availableCollections.find(
    (collection) => normalizeAddress(collection.address) === normalizedAddress,
  );
}

export function getCollectionFilterConfig(
  address: string,
  collections?: SeedCollection[],
): CollectionFilterConfig {
  const normalizedAddress = normalizeAddress(address);
  const directConfig = COLLECTION_FILTER_CONFIGS[normalizedAddress];
  if (directConfig) {
    return directConfig;
  }

  const runtimeCollection = resolveCollectionByAddress(
    normalizedAddress,
    collections,
  );
  if (!runtimeCollection) {
    return DEFAULT_COLLECTION_FILTER_CONFIG;
  }

  return COLLECTION_NAME_CONFIGS[
    normalizeCollectionName(runtimeCollection.name)
  ] ?? DEFAULT_COLLECTION_FILTER_CONFIG;
}
