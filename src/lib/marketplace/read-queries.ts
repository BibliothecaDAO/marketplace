import { queryOptions } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  TokenDetails,
  TokenDetailsOptions,
} from "@cartridge/arcade/marketplace";
import {
  createEdgeMarketplaceClient,
  fetchTraitNamesSummary as fetchEdgeTraitNamesSummary,
  fetchTraitValues as fetchEdgeTraitValues,
} from "@cartridge/arcade/marketplace/edge";
import { getMarketplaceRuntimeConfig, type SeedCollection } from "@/lib/marketplace/config";
import {
  alternateTokenId,
  canonicalizeTokenId,
  expandTokenIdQueryVariants,
  expandTokenIdVariants,
} from "@/lib/marketplace/token-id";
import type { ActiveFilters, TraitSelection } from "@/lib/marketplace/traits";
import { aggregateTraitSummaryPages, aggregateTraitValuePages } from "@/lib/marketplace/traits";

const DEFAULT_HOME_TOKEN_LIMIT = 12;
const DEFAULT_GRID_LIMIT = 24;
const DEFAULT_ORDER_LIMIT = 24;
const DEFAULT_BALANCE_LIMIT = 200;
const DEFAULT_PROJECT_ID = "arcade-main";

type EdgeMarketplaceClient = Awaited<ReturnType<typeof createEdgeMarketplaceClient>>;

type TokenBalanceRow = {
  contract_address: string;
  account_address: string;
  token_id: string;
  balance: string;
};

type TokenBalancesPage = {
  page: {
    balances: TokenBalanceRow[];
    nextCursor: string | null;
  };
  error: null;
};

function toSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue),
  ) as T;
}

function hasUsableToken(data: TokenDetails | null | undefined): data is TokenDetails {
  return data !== null && data !== undefined && data.token !== null && data.token !== undefined;
}

function normalizeCollectionAddress(address: string) {
  const trimmed = address.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  if (!/^0x[0-9a-f]+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    return `0x${BigInt(trimmed).toString(16)}`;
  } catch {
    return trimmed;
  }
}

function collectionScopedTokenIdCandidates(collection: string, tokenId: string) {
  const normalizedCollection = normalizeCollectionAddress(collection);
  if (!normalizedCollection) {
    return [];
  }

  const candidates = new Set<string>();
  const alternate = alternateTokenId(tokenId);
  candidates.add(`${normalizedCollection}:${tokenId}`);
  if (alternate && alternate !== tokenId) {
    candidates.add(`${normalizedCollection}:${alternate}`);
  }

  return Array.from(candidates);
}

function stableArray(values: Iterable<unknown> | undefined) {
  if (!values) {
    return [];
  }

  return Array.from(values, (value) => String(value)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function stableAttributeFilters(
  filters:
    | Record<string, unknown>
    | undefined,
) {
  if (!filters) {
    return "";
  }

  return JSON.stringify(
    Object.entries(filters)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, values]) => [
        name,
        (Array.isArray(values)
          ? [...values]
          : values && typeof values === "object" && Symbol.iterator in values
            ? Array.from(values as Iterable<unknown>)
            : values !== null && values !== undefined
              ? [values]
              : [])
          .map((value) => String(value))
          .sort((left, right) => left.localeCompare(right)),
      ]),
  );
}

function normalizePaddedAddress(address: string) {
  const trimmed = address.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  try {
    const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    return `0x${BigInt(`0x${hex}`).toString(16).padStart(64, "0")}`;
  } catch {
    return null;
  }
}

function stableTraitSelections(values: TraitSelection[] | undefined) {
  if (!values) {
    return [];
  }

  return [...values].sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.value.localeCompare(right.value);
  });
}

function asAttributeFilters(activeFilters: ActiveFilters | undefined) {
  if (!activeFilters || Object.keys(activeFilters).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(activeFilters)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, values]) => [name, Array.from(values).sort((left, right) => left.localeCompare(right))]),
  );
}

function escapeSqlValue(value: string) {
  return value.replace(/'/g, "''");
}

function extractRows(data: unknown) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.rows)) return record.rows;
    if (Array.isArray(record.result)) return record.result;
  }

  return [];
}

function toSqlList(values: string[]) {
  return values.map((value) => `'${escapeSqlValue(value)}'`).join(", ");
}

function normalizeQueryTokenIds(tokenIds: string[] | undefined) {
  if (!tokenIds || tokenIds.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tokenId of tokenIds) {
    const canonical = canonicalizeTokenId(tokenId);
    const next = canonical ? canonical.decimal : tokenId.trim();
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}

function normalizeAddressList(addresses: string[] | undefined) {
  if (!addresses || addresses.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const address of addresses) {
    const next = normalizePaddedAddress(address);
    if (!next) {
      continue;
    }

    if (!seen.has(next)) {
      seen.add(next);
      normalized.push(next);
    }
  }

  return normalized;
}

function resolveDefaultProjectId() {
  const { sdkConfig } = getMarketplaceRuntimeConfig();
  return sdkConfig.defaultProject ?? DEFAULT_PROJECT_ID;
}

async function fetchToriiSql(projectId: string, sql: string) {
  const response = await fetch(`https://api.cartridge.gg/x/${projectId}/torii/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: sql,
  });

  if (!response.ok) {
    throw new Error(`Torii SQL request failed with ${response.status}`);
  }

  const data = await response.json();
  return extractRows(data);
}

let edgeClientPromise: Promise<EdgeMarketplaceClient> | null = null;

async function getEdgeMarketplaceClient() {
  if (!edgeClientPromise) {
    const { sdkConfig } = getMarketplaceRuntimeConfig();
    edgeClientPromise = createEdgeMarketplaceClient({
      ...sdkConfig,
      runtime: "edge",
    }).catch((error) => {
      edgeClientPromise = null;
      throw error;
    });
  }

  return edgeClientPromise;
}

export function resolveCollectionProjectId(
  address: string,
  collections?: SeedCollection[],
) {
  const runtimeCollections = collections ?? getMarketplaceRuntimeConfig().collections;
  return runtimeCollections.find((collection) => collection.address === address)?.projectId;
}

export function selectFeaturedHomeCollection(collections?: SeedCollection[]) {
  const runtimeCollections = collections ?? getMarketplaceRuntimeConfig().collections;
  return runtimeCollections[0] ?? null;
}

async function fetchCollection(options: CollectionSummaryOptions) {
  const client = await getEdgeMarketplaceClient();
  return toSerializable(await client.getCollection(options));
}

async function fetchCollectionTokens(options: FetchCollectionTokensOptions) {
  const client = await getEdgeMarketplaceClient();
  return toSerializable(await client.listCollectionTokens(options));
}

async function fetchCollectionOrders(options: CollectionOrdersOptions) {
  const client = await getEdgeMarketplaceClient();
  return toSerializable(await client.getCollectionOrders(options));
}

async function fetchCollectionListings(options: CollectionListingsOptions) {
  const client = await getEdgeMarketplaceClient();
  return toSerializable(await client.listCollectionListings(options));
}

async function fetchTokenWithFallback(options: TokenDetailsOptions) {
  const client = await getEdgeMarketplaceClient();
  const tokenId = String(options.tokenId);
  const candidates: string[] = [tokenId];
  const alternate = alternateTokenId(tokenId);
  if (alternate && alternate !== tokenId) {
    candidates.push(alternate);
  }

  const canonical = canonicalizeTokenId(tokenId);
  const paddedTokenId = canonical
    ? `0x${canonical.value.toString(16).padStart(64, "0")}`
    : null;
  if (paddedTokenId && !candidates.includes(paddedTokenId)) {
    candidates.push(paddedTokenId);
  }

  for (const scopedTokenId of collectionScopedTokenIdCandidates(options.collection, tokenId)) {
    if (!candidates.includes(scopedTokenId)) {
      candidates.push(scopedTokenId);
    }
  }

  let lastResponse: TokenDetails | null = null;
  for (const candidate of candidates) {
    const response = await client.getToken({
      ...options,
      tokenId: candidate,
    });
    lastResponse = response ? toSerializable(response) : response;
    if (hasUsableToken(response)) {
      return toSerializable(response);
    }
  }

  return lastResponse;
}

async function fetchTraitNamesSummary(options: {
  address: string;
  projectId?: string;
}) {
  const result = await fetchEdgeTraitNamesSummary({
    address: options.address,
    defaultProjectId: options.projectId,
  });

  return aggregateTraitSummaryPages(result.pages);
}

async function fetchTraitValues(options: {
  address: string;
  traitName: string | null;
  otherTraitFilters?: TraitSelection[];
  projectId?: string;
}) {
  if (!options.traitName) {
    return [];
  }

  const result = await fetchEdgeTraitValues({
    address: options.address,
    traitName: options.traitName,
    otherTraitFilters: options.otherTraitFilters,
    defaultProjectId: options.projectId,
  });

  return aggregateTraitValuePages(result.pages);
}

async function fetchTokenBalances(options: {
  project?: string;
  contractAddresses?: string[];
  accountAddresses?: string[];
  tokenIds?: string[];
  cursor?: string;
  limit?: number;
}) {
  const projectId = options.project ?? resolveDefaultProjectId();
  const offset = options.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_BALANCE_LIMIT));
  const conditions = ["balance > 0"];

  const contractAddresses = normalizeAddressList(options.contractAddresses);
  if (contractAddresses.length > 0) {
    conditions.push(`lower(contract_address) IN (${toSqlList(contractAddresses)})`);
  }

  const accountAddresses = normalizeAddressList(options.accountAddresses);
  if (accountAddresses.length > 0) {
    conditions.push(`lower(account_address) IN (${toSqlList(accountAddresses)})`);
  }

  const tokenIds = normalizeQueryTokenIds(options.tokenIds);
  if (tokenIds.length > 0) {
    conditions.push(`token_id IN (${toSqlList(tokenIds)})`);
  }

  const rows = (await fetchToriiSql(
    projectId,
    `SELECT contract_address, account_address, token_id, balance
FROM token_balances
WHERE ${conditions.join(" AND ")}
ORDER BY contract_address, token_id, account_address
LIMIT ${limit}
OFFSET ${Math.max(0, offset)}`,
  )) as TokenBalanceRow[];

  return {
    page: {
      balances: rows,
      nextCursor: rows.length >= limit ? String(offset + rows.length) : null,
    },
    error: null,
  } satisfies TokenBalancesPage;
}

export const marketplaceReadKeys = {
  collection: (options: CollectionSummaryOptions) => [
    "marketplace-read",
    "collection",
    options.address,
    options.projectId,
    options.fetchImages ?? false,
  ] as const,
  collectionTokens: (options: FetchCollectionTokensOptions) => [
    "marketplace-read",
    "collection-tokens",
    options.address,
    options.project,
    options.cursor,
    stableArray(options.tokenIds),
    stableAttributeFilters(options.attributeFilters),
    options.limit ?? DEFAULT_GRID_LIMIT,
    options.fetchImages ?? false,
  ] as const,
  collectionOrders: (options: CollectionOrdersOptions) => [
    "marketplace-read",
    "collection-orders",
    options.collection,
    options.tokenId,
    options.status,
    options.category,
    options.limit ?? DEFAULT_ORDER_LIMIT,
    stableArray(options.orderIds),
  ] as const,
  collectionListings: (options: CollectionListingsOptions) => [
    "marketplace-read",
    "collection-listings",
    options.collection,
    options.projectId,
    options.tokenId,
    options.limit ?? DEFAULT_ORDER_LIMIT,
    options.verifyOwnership ?? false,
  ] as const,
  tokenDetail: (options: TokenDetailsOptions) => [
    "marketplace-read",
    "token-detail",
    options.collection,
    String(options.tokenId),
    options.projectId,
    options.fetchImages ?? false,
  ] as const,
  traitNamesSummary: (options: { address: string; projectId?: string }) => [
    "marketplace-read",
    "trait-names-summary",
    options.address,
    options.projectId,
  ] as const,
  traitValues: (options: {
    address: string;
    traitName: string | null;
    otherTraitFilters?: TraitSelection[];
    projectId?: string;
  }) => [
    "marketplace-read",
    "trait-values",
    options.address,
    options.traitName,
    stableTraitSelections(options.otherTraitFilters),
    options.projectId,
  ] as const,
  tokenBalances: (options: {
    project?: string;
    contractAddresses?: string[];
    accountAddresses?: string[];
    tokenIds?: string[];
    cursor?: string;
    limit?: number;
  }) => [
    "marketplace-read",
    "token-balances",
    options.project,
    stableArray(options.contractAddresses),
    stableArray(options.accountAddresses),
    stableArray(options.tokenIds),
    options.cursor,
    options.limit ?? DEFAULT_BALANCE_LIMIT,
  ] as const,
};

export function collectionQueryOptions(options: CollectionSummaryOptions) {
  return queryOptions({
    queryKey: marketplaceReadKeys.collection(options),
    queryFn: () => fetchCollection(options),
  });
}

export function collectionTokensQueryOptions(options: FetchCollectionTokensOptions) {
  return queryOptions({
    queryKey: marketplaceReadKeys.collectionTokens(options),
    queryFn: () => fetchCollectionTokens(options),
  });
}

export function collectionOrdersQueryOptions(options: CollectionOrdersOptions) {
  return queryOptions({
    queryKey: marketplaceReadKeys.collectionOrders(options),
    queryFn: () => fetchCollectionOrders(options),
  });
}

export function collectionListingsQueryOptions(options: CollectionListingsOptions) {
  return queryOptions({
    queryKey: marketplaceReadKeys.collectionListings(options),
    queryFn: () => fetchCollectionListings(options),
  });
}

export function tokenDetailQueryOptions(options: TokenDetailsOptions) {
  return queryOptions({
    queryKey: marketplaceReadKeys.tokenDetail(options),
    queryFn: () => fetchTokenWithFallback(options),
  });
}

export function traitNamesSummaryQueryOptions(options: {
  address: string;
  projectId?: string;
}) {
  return queryOptions({
    queryKey: marketplaceReadKeys.traitNamesSummary(options),
    queryFn: () => fetchTraitNamesSummary(options),
  });
}

export function traitValuesQueryOptions(options: {
  address: string;
  traitName: string | null;
  otherTraitFilters?: TraitSelection[];
  projectId?: string;
}) {
  return queryOptions({
    queryKey: marketplaceReadKeys.traitValues(options),
    queryFn: () => fetchTraitValues(options),
  });
}

export function tokenBalancesQueryOptions(options: {
  project?: string;
  contractAddresses?: string[];
  accountAddresses?: string[];
  tokenIds?: string[];
  cursor?: string;
  limit?: number;
}) {
  return queryOptions({
    queryKey: marketplaceReadKeys.tokenBalances(options),
    queryFn: () => fetchTokenBalances(options),
  });
}

export function getInitialCollectionTokensOptions(options: {
  address: string;
  projectId?: string;
  cursor?: string | null;
  activeFilters?: ActiveFilters;
}) {
  return {
    address: options.address,
    project: options.projectId,
    cursor: options.cursor ?? undefined,
    limit: DEFAULT_GRID_LIMIT,
    fetchImages: true,
    attributeFilters: asAttributeFilters(options.activeFilters),
  } satisfies FetchCollectionTokensOptions;
}

export function getInitialListedTokensOptions(options: {
  address: string;
  projectId?: string;
  listedTokenIds: Iterable<string>;
  activeFilters?: ActiveFilters;
}) {
  const tokenIds = expandTokenIdQueryVariants(options.listedTokenIds);
  return {
    address: options.address,
    project: options.projectId,
    tokenIds: tokenIds.length > 0 ? tokenIds : undefined,
    limit: Math.max(tokenIds.length, 1),
    fetchImages: true,
    attributeFilters: asAttributeFilters(options.activeFilters),
  } satisfies FetchCollectionTokensOptions;
}

export function getInitialHomeTokensOptions(options: {
  address: string;
  projectId?: string;
}) {
  return {
    address: options.address,
    project: options.projectId,
    limit: DEFAULT_HOME_TOKEN_LIMIT,
    fetchImages: true,
  } satisfies FetchCollectionTokensOptions;
}

export function getPortfolioTokenIds(tokenIds: Iterable<string>) {
  return expandTokenIdVariants(tokenIds);
}

/** @internal */
export function _resetReadQueryCaches() {
  edgeClientPromise = null;
}
