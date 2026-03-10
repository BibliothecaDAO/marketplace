import { queryOptions } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  NormalizedToken,
  TokenDetailsOptions,
} from "@cartridge/arcade/marketplace";
import { getMarketplaceRuntimeConfig, type SeedCollection } from "@/lib/marketplace/config";
import {
  alternateTokenId,
  canonicalizeTokenId,
  expandTokenIdQueryVariants,
} from "@/lib/marketplace/token-id";
import { formatNumberish } from "@/lib/marketplace/token-display";

const DEFAULT_PROJECT_ID = "arcade-main";
const DEFAULT_TOKEN_LISTING_LIMIT = 50;

type TokenDetailResult = {
  projectId: string;
  token: NormalizedToken;
  orders: unknown[];
  listings: unknown[];
} | null;

function tokenDetailQueryKey(options: TokenDetailsOptions) {
  return [
    "marketplace-read",
    "token-detail",
    options.collection,
    String(options.tokenId),
    options.projectId,
    options.fetchImages ?? false,
  ] as const;
}

function tokenListingsQueryKey(options: CollectionListingsOptions) {
  return [
    "marketplace-read",
    "collection-listings",
    options.collection,
    options.projectId,
    options.tokenId,
    options.limit ?? 24,
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

function tokenIdCandidates(collection: string, tokenId: string) {
  const candidates = new Set<string>(expandTokenIdQueryVariants([tokenId]));
  const canonical = canonicalizeTokenId(tokenId);
  if (canonical) {
    candidates.add(canonical.decimal);
    candidates.add(canonical.hex);
  }

  for (const scoped of collectionScopedTokenIdCandidates(collection, tokenId)) {
    candidates.add(scoped);
  }

  return Array.from(candidates);
}

function escapeSqlValue(value: string) {
  return value.replace(/'/g, "''");
}

function toSqlList(values: string[]) {
  return values.map((value) => `'${escapeSqlValue(value)}'`).join(", ");
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

function normalizeTokenRow(row: unknown): NormalizedToken | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

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

function asBigInt(value: unknown) {
  const normalized = formatNumberish(value);
  if (!normalized) {
    return null;
  }

  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

function isActiveSellOrder(row: unknown, nowEpochSeconds: bigint) {
  const record = asRecord(row);
  if (!record) {
    return false;
  }

  const category = asBigInt(record.category);
  const status = asBigInt(record.status);
  if (category !== BigInt(2) || status !== BigInt(1)) {
    return false;
  }

  const expiration = asBigInt(record.expiration);
  if (expiration && expiration > BigInt(0) && expiration <= nowEpochSeconds) {
    return false;
  }

  return true;
}

async function filterVerifiedListings(projectId: string, collection: string, listings: unknown[]) {
  if (listings.length === 0) {
    return listings;
  }

  const normalizedCollection = normalizePaddedAddress(collection) ?? collection;
  const owners = new Set<string>();
  const tokenIds = new Set<string>();

  for (const listing of listings) {
    const record = asRecord(listing);
    if (!record) {
      continue;
    }

    const owner = normalizePaddedAddress(String(record.owner ?? ""));
    const tokenId = formatNumberish(record.token_id);
    if (owner) {
      owners.add(owner.toLowerCase());
    }
    if (tokenId) {
      tokenIds.add(tokenId);
    }
  }

  if (owners.size === 0 || tokenIds.size === 0) {
    return [];
  }

  const rows = await fetchToriiSql(
    projectId,
    `SELECT account_address, token_id, balance
FROM token_balances
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedCollection)}')
  AND lower(account_address) IN (${toSqlList(Array.from(owners))})
  AND token_id IN (${toSqlList(Array.from(tokenIds))})`,
  );

  const validOwnership = new Set<string>();
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    const balance = asBigInt(record.balance);
    const owner = normalizePaddedAddress(String(record.account_address ?? ""));
    const tokenId = formatNumberish(record.token_id);
    if (!owner || !tokenId || !balance || balance <= BigInt(0)) {
      continue;
    }

    validOwnership.add(`${owner.toLowerCase()}:${tokenId}`);
  }

  return listings.filter((listing) => {
    const record = asRecord(listing);
    if (!record) {
      return false;
    }

    const owner = normalizePaddedAddress(String(record.owner ?? ""));
    const tokenId = formatNumberish(record.token_id);
    if (!owner || !tokenId) {
      return false;
    }

    return validOwnership.has(`${owner.toLowerCase()}:${tokenId}`);
  });
}

async function fetchTokenOrders(projectId: string, collection: string, tokenIds: string[], limit: number) {
  const normalizedCollection = normalizePaddedAddress(collection) ?? collection;
  const rows = await fetchToriiSql(
    projectId,
    `SELECT id, category, status, expiration, collection, token_id, quantity, price, currency, owner
FROM "ARCADE-Order"
WHERE lower(collection) = lower('${escapeSqlValue(normalizedCollection)}')
  AND token_id IN (${toSqlList(tokenIds)})
ORDER BY id DESC
LIMIT ${Math.max(1, Math.floor(limit))}`,
  );

  return rows;
}

async function fetchTokenDetail(options: TokenDetailsOptions): Promise<TokenDetailResult> {
  const projectId = resolveProjectId(options.projectId);
  const normalizedCollection = normalizePaddedAddress(options.collection) ?? options.collection;
  const candidates = tokenIdCandidates(options.collection, String(options.tokenId));

  const tokenRows = await fetchToriiSql(
    projectId,
    `SELECT contract_address, token_id, metadata, name, symbol, decimals
FROM tokens
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedCollection)}')
  AND token_id IN (${toSqlList(candidates)})
ORDER BY token_id
LIMIT 1`,
  );

  const token = normalizeTokenRow(tokenRows[0]);
  if (!token) {
    return null;
  }

  const tokenLookupIds = tokenIdCandidates(options.collection, String(token.token_id));
  const orders = await fetchTokenOrders(
    projectId,
    options.collection,
    tokenLookupIds,
    DEFAULT_TOKEN_LISTING_LIMIT,
  );
  const activeListings = orders.filter((row) =>
    isActiveSellOrder(row, BigInt(Math.floor(Date.now() / 1000))),
  );
  const listings =
    options.verifyOwnership === false
      ? activeListings
      : await filterVerifiedListings(projectId, options.collection, activeListings);

  return {
    projectId,
    token,
    orders,
    listings,
  };
}

async function fetchTokenListings(options: CollectionListingsOptions) {
  const projectId = resolveProjectId(options.projectId);
  const tokenIds = tokenIdCandidates(options.collection, String(options.tokenId ?? ""));
  const orders = await fetchTokenOrders(
    projectId,
    options.collection,
    tokenIds,
    options.limit ?? DEFAULT_TOKEN_LISTING_LIMIT,
  );
  const activeListings = orders.filter((row) =>
    isActiveSellOrder(row, BigInt(Math.floor(Date.now() / 1000))),
  );

  if (options.verifyOwnership === false) {
    return activeListings;
  }

  return filterVerifiedListings(projectId, options.collection, activeListings);
}

export function resolveCollectionProjectId(
  address: string,
  collections?: SeedCollection[],
) {
  const runtimeCollections = collections ?? getMarketplaceRuntimeConfig().collections;
  return runtimeCollections.find((collection) => collection.address === address)?.projectId;
}

export function tokenDetailQueryOptions(options: TokenDetailsOptions) {
  return queryOptions({
    queryKey: tokenDetailQueryKey(options),
    queryFn: () => fetchTokenDetail(options),
  });
}

export function tokenListingsQueryOptions(options: CollectionListingsOptions) {
  return queryOptions({
    queryKey: tokenListingsQueryKey(options),
    queryFn: () => fetchTokenListings(options),
  });
}
