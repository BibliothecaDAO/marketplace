export type NormalizedToken = {
  contract_address: string;
  token_id?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  metadata: Record<string, unknown>;
  total_supply?: string;
  image?: string;
  owner?: string | null;
  price?: string;
  currency?: string;
  first_seen_block?: number;
  best_listing?: MarketplaceOrderCompat | null;
};

export type MarketplaceCollection = {
  address: string;
  metadata: Record<string, unknown>;
  totalSupply: string;
  listingCount: string;
  floorByCurrency: Array<{
    currency: string;
    symbol: string;
    unitPriceAtomic: string;
  }>;
};

export type MarketplaceOrderCompat = {
  id: string;
  collection: string;
  tokenId: string;
  token_id: string;
  category: string;
  categoryRaw: number;
  status: string;
  statusRaw: number;
  owner: string;
  currency: string;
  price: string;
  unitPriceAtomic: string;
  quantity: string;
  originalQuantity: string;
  remainingQuantity: string;
  expiration: string;
  royalties: boolean;
  createdAt: unknown;
  updatedAt: unknown;
};

export type TokenBalanceCompat = {
  account_address: string;
  contract_address: string;
  token_id: string;
  balance: string;
  token?: NormalizedToken;
};

export type CollectionSummaryOptions = {
  address: string;
  projectId?: string;
  fetchImages?: boolean;
};

export type FetchCollectionTokensOptions = {
  address: string;
  project?: string;
  cursor?: string | null;
  limit?: number;
  tokenIds?: string[];
  fetchImages?: boolean;
  attributeFilters?:
    | Record<string, string[]>
    | Array<{ traitName?: string; traitValue?: string; name?: string; value?: string }>;
  sort?: string;
  currency?: string;
  rangeFilters?: Array<{ name: string; min: number; max: number }>;
};

export type CollectionOrdersOptions = {
  collection: string;
  projectId?: string;
  cursor?: string | null;
  limit?: number;
  currency?: string;
  tokenId?: string;
  category?: string;
  status?: string;
};

export type CollectionListingsOptions = CollectionOrdersOptions & {
  verifyOwnership?: boolean;
};

export type TokenDetailsOptions = {
  collection: string;
  tokenId: string | number | bigint;
  projectId?: string;
  fetchImages?: boolean;
  currency?: string;
};

export type TokenDetails = {
  token: NormalizedToken | null;
  orders: MarketplaceOrderCompat[];
  listings: MarketplaceOrderCompat[];
  activity?: unknown[];
};
