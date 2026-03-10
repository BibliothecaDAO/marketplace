import { queryOptions } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  NormalizedToken,
} from "@cartridge/arcade/marketplace";
import { getMarketplaceRuntimeConfig, type SeedCollection } from "@/lib/marketplace/config";
import { formatNumberish } from "@/lib/marketplace/token-display";

const DEFAULT_HOME_TOKEN_LIMIT = 12;
const DEFAULT_HOME_LISTING_LIMIT = 100;
const DEFAULT_PROJECT_ID = "arcade-main";
const DEFAULT_ORDER_LIMIT = 24;

function stableArray(values: Iterable<unknown> | undefined) {
  if (!values) {
    return [];
  }

  return Array.from(values, (value) => String(value)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function stableAttributeFilters(filters: Record<string, unknown> | undefined) {
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

function collectionQueryKey(options: CollectionSummaryOptions) {
  return [
    "marketplace-read",
    "collection",
    options.address,
    options.projectId,
    options.fetchImages ?? false,
  ] as const;
}

function collectionTokensQueryKey(options: FetchCollectionTokensOptions) {
  return [
    "marketplace-read",
    "collection-tokens",
    options.address,
    options.project,
    options.cursor,
    stableArray(options.tokenIds),
    stableAttributeFilters(options.attributeFilters as Record<string, unknown> | undefined),
    options.limit ?? DEFAULT_HOME_TOKEN_LIMIT,
    options.fetchImages ?? false,
  ] as const;
}

function collectionListingsQueryKey(options: CollectionListingsOptions) {
  return [
    "marketplace-read",
    "collection-listings",
    options.collection,
    options.projectId,
    options.tokenId,
    options.limit ?? DEFAULT_ORDER_LIMIT,
    options.verifyOwnership ?? false,
  ] as const;
}

function resolveDefaultProjectId() {
  const { sdkConfig } = getMarketplaceRuntimeConfig();
  return sdkConfig.defaultProject ?? DEFAULT_PROJECT_ID;
}

function resolveProjectId(projectId?: string) {
  return projectId ?? resolveDefaultProjectId();
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

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonSafe(value: unknown) {
  if (typeof value !== "string") {
    return asRecord(value);
  }

  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function resolveTokenImage(metadata: Record<string, unknown> | null) {
  const image = metadata?.image ?? metadata?.image_url;
  return typeof image === "string" && image.trim().length > 0 ? image : null;
}

function normalizeHomeToken(row: unknown): NormalizedToken {
  const record = asRecord(row) ?? {};
  const metadata = parseJsonSafe(record.metadata);
  const tokenId = formatNumberish(record.token_id) ?? String(record.token_id ?? "unknown");

  return {
    contract_address: String(record.contract_address ?? ""),
    token_id: tokenId,
    metadata,
    image: resolveTokenImage(metadata),
    name: typeof record.name === "string" ? record.name : undefined,
    symbol: typeof record.symbol === "string" ? record.symbol : undefined,
    decimals:
      typeof record.decimals === "number" || typeof record.decimals === "string"
        ? record.decimals
        : undefined,
  } as NormalizedToken;
}

async function fetchHomeCollection(options: CollectionSummaryOptions) {
  const projectId = resolveProjectId(options.projectId);
  const normalizedAddress = normalizePaddedAddress(options.address) ?? options.address;
  const contractRows = await fetchToriiSql(
    projectId,
    `SELECT contract_address, metadata, total_supply
FROM token_contracts
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedAddress)}')
LIMIT 1`,
  );
  const contract = asRecord(contractRows[0]);
  if (!contract) {
    return null;
  }

  let metadata = parseJsonSafe(contract.metadata);
  if (!metadata) {
    const tokenRows = await fetchToriiSql(
      projectId,
      `SELECT metadata
FROM tokens
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedAddress)}')
LIMIT 1`,
    );
    metadata = parseJsonSafe(asRecord(tokenRows[0])?.metadata);
  }

  return {
    address: options.address,
    metadata,
    totalSupply: formatNumberish(contract.total_supply),
  };
}

async function fetchHomeCollectionTokens(options: FetchCollectionTokensOptions) {
  const projectId = resolveProjectId(options.project);
  const normalizedAddress = normalizePaddedAddress(options.address) ?? options.address;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_HOME_TOKEN_LIMIT));
  const rows = await fetchToriiSql(
    projectId,
    `SELECT contract_address, token_id, metadata, name, symbol, decimals
FROM tokens
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedAddress)}')
ORDER BY token_id
LIMIT ${limit}`,
  );

  return {
    page: {
      tokens: rows.map(normalizeHomeToken),
      nextCursor: null,
    },
    error: null,
  };
}

async function fetchHomeCollectionListings(options: CollectionListingsOptions) {
  const normalizedCollection = normalizePaddedAddress(options.collection) ?? options.collection;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_HOME_LISTING_LIMIT));
  const rows = await fetchToriiSql(
    resolveProjectId(options.projectId),
    `SELECT id, category, status, expiration, collection, token_id, quantity, price, currency, owner
FROM "ARCADE-Order"
WHERE lower(collection) = lower('${escapeSqlValue(normalizedCollection)}')
  AND category = 2
  AND status = 1
ORDER BY id DESC
LIMIT ${limit}`,
  );

  return rows;
}

export function selectFeaturedHomeCollection(collections?: SeedCollection[]) {
  const runtimeCollections = collections ?? getMarketplaceRuntimeConfig().collections;
  return runtimeCollections[0] ?? null;
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

export function homeCollectionQueryOptions(options: CollectionSummaryOptions) {
  return queryOptions({
    queryKey: collectionQueryKey(options),
    queryFn: () => fetchHomeCollection(options),
  });
}

export function homeCollectionTokensQueryOptions(options: FetchCollectionTokensOptions) {
  return queryOptions({
    queryKey: collectionTokensQueryKey(options),
    queryFn: () => fetchHomeCollectionTokens(options),
  });
}

export function homeCollectionListingsQueryOptions(options: CollectionListingsOptions) {
  return queryOptions({
    queryKey: collectionListingsQueryKey(options),
    queryFn: () => fetchHomeCollectionListings(options),
  });
}
