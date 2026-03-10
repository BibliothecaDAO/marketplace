import { queryOptions } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
} from "@cartridge/arcade/marketplace";
import { getMarketplaceRuntimeConfig, type SeedCollection } from "@/lib/marketplace/config";
import { expandTokenIdQueryVariants } from "@/lib/marketplace/token-id";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { formatNumberish } from "@/lib/marketplace/token-display";

const DEFAULT_GRID_LIMIT = 24;
const DEFAULT_ORDER_LIMIT = 24;
const DEFAULT_PROJECT_ID = "arcade-main";

function collectionQueryKey(options: CollectionSummaryOptions) {
  return [
    "marketplace-read",
    "collection",
    options.address,
    options.projectId,
    options.fetchImages ?? false,
  ] as const;
}

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

function collectionTokensQueryKey(options: FetchCollectionTokensOptions) {
  return [
    "marketplace-read",
    "collection-tokens",
    options.address,
    options.project,
    options.cursor,
    stableArray(options.tokenIds),
    stableAttributeFilters(options.attributeFilters as Record<string, unknown> | undefined),
    options.limit ?? DEFAULT_GRID_LIMIT,
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

function collectionOrdersQueryKey(options: CollectionOrdersOptions) {
  return [
    "marketplace-read",
    "collection-orders",
    options.collection,
    options.tokenId,
    options.status,
    options.category,
    options.limit ?? DEFAULT_ORDER_LIMIT,
    stableArray(options.orderIds),
  ] as const;
}

function traitNamesSummaryQueryKey(options: {
  address: string;
  projectId?: string;
}) {
  return [
    "marketplace-read",
    "trait-names-summary",
    options.address,
    options.projectId,
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

function normalizeTokenRow(row: unknown) {
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
  };
}

function tokenMatchesFilters(token: ReturnType<typeof normalizeTokenRow>, attributeFilters: FetchCollectionTokensOptions["attributeFilters"]) {
  if (!token || !attributeFilters || Object.keys(attributeFilters).length === 0) {
    return true;
  }

  const metadata = asRecord(token.metadata);
  const attributes = Array.isArray(metadata?.attributes) ? metadata.attributes : [];
  if (attributes.length === 0) {
    return false;
  }

  const traitMap = new Map<string, Set<string>>();
  for (const rawAttribute of attributes) {
    const attribute = asRecord(rawAttribute);
    if (!attribute) {
      continue;
    }

    const traitName = String(attribute.trait_type ?? attribute.traitName ?? attribute.name ?? "").trim();
    const traitValue = String(attribute.value ?? attribute.traitValue ?? "").trim();
    if (!traitName || !traitValue) {
      continue;
    }

    if (!traitMap.has(traitName)) {
      traitMap.set(traitName, new Set());
    }
    traitMap.get(traitName)?.add(traitValue);
  }

  for (const [traitName, rawValues] of Object.entries(attributeFilters)) {
    const selected = Array.isArray(rawValues)
      ? rawValues.map((value) => String(value))
      : rawValues !== null && rawValues !== undefined
        ? [String(rawValues)]
        : [];
    if (selected.length === 0) {
      continue;
    }

    const available = traitMap.get(traitName);
    if (!available) {
      return false;
    }

    if (!selected.some((value) => available.has(value))) {
      return false;
    }
  }

  return true;
}

async function fetchCollection(options: CollectionSummaryOptions) {
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

async function fetchCollectionTokens(options: FetchCollectionTokensOptions) {
  const projectId = resolveProjectId(options.project);
  const normalizedAddress = normalizePaddedAddress(options.address) ?? options.address;
  const offset = options.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_GRID_LIMIT));
  const requestedTokenIds = options.tokenIds?.map((tokenId) => String(tokenId)).filter(Boolean) ?? [];
  const fetchLimit = requestedTokenIds.length > 0
    ? Math.max(requestedTokenIds.length, 1)
    : options.attributeFilters && Object.keys(options.attributeFilters).length > 0
      ? Math.max(limit * 4, limit)
      : limit;
  const conditions = [`lower(contract_address) = lower('${escapeSqlValue(normalizedAddress)}')`];
  if (requestedTokenIds.length > 0) {
    conditions.push(`token_id IN (${toSqlList(requestedTokenIds)})`);
  }

  const rows = await fetchToriiSql(
    projectId,
    `SELECT contract_address, token_id, metadata, name, symbol, decimals
FROM tokens
WHERE ${conditions.join(" AND ")}
ORDER BY token_id
LIMIT ${fetchLimit}
OFFSET ${Math.max(0, offset)}`,
  );

  const normalizedTokens = rows
    .map(normalizeTokenRow)
    .filter((token): token is NonNullable<typeof token> =>
      token !== null && tokenMatchesFilters(token, options.attributeFilters),
    )
    .slice(0, limit);

  return {
    page: {
      tokens: normalizedTokens,
      nextCursor: requestedTokenIds.length > 0 || rows.length < fetchLimit ? null : String(offset + rows.length),
    },
    error: null,
  };
}

async function fetchCollectionListings(options: CollectionListingsOptions) {
  const projectId = resolveProjectId(options.projectId);
  const normalizedCollection = normalizePaddedAddress(options.collection) ?? options.collection;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_ORDER_LIMIT));
  const conditions = [`lower(collection) = lower('${escapeSqlValue(normalizedCollection)}')`];
  if (options.tokenId) {
    conditions.push(`token_id = '${escapeSqlValue(String(options.tokenId))}'`);
  }
  conditions.push("category = 2");
  conditions.push("status = 1");

  const rows = await fetchToriiSql(
    projectId,
    `SELECT id, category, status, expiration, collection, token_id, quantity, price, currency, owner
FROM "ARCADE-Order"
WHERE ${conditions.join(" AND ")}
ORDER BY id DESC
LIMIT ${limit}`,
  );

  return rows;
}

async function fetchCollectionOrders(options: CollectionOrdersOptions) {
  const normalizedCollection = normalizePaddedAddress(options.collection) ?? options.collection;
  const conditions = [`lower(collection) = lower('${escapeSqlValue(normalizedCollection)}')`];
  if (options.tokenId) {
    conditions.push(`token_id = '${escapeSqlValue(String(options.tokenId))}'`);
  }
  if (options.status === "Placed") {
    conditions.push("status = 1");
  }
  if (options.status === "Canceled") {
    conditions.push("status = 2");
  }
  if (options.status === "Executed") {
    conditions.push("status = 3");
  }
  if (options.category === "Buy") {
    conditions.push("category = 1");
  }
  if (options.category === "Sell") {
    conditions.push("category = 2");
  }

  const rows = await fetchToriiSql(
    resolveDefaultProjectId(),
    `SELECT id, category, status, expiration, collection, token_id, quantity, price, currency, owner
FROM "ARCADE-Order"
WHERE ${conditions.join(" AND ")}
ORDER BY id DESC
LIMIT ${Math.max(1, Math.floor(options.limit ?? DEFAULT_ORDER_LIMIT))}`,
  );

  return rows;
}

async function fetchTraitNamesSummary(options: {
  address: string;
  projectId?: string;
}) {
  const collectionPrefix = `${normalizePaddedAddress(options.address) ?? options.address}:%`;
  const rows = await fetchToriiSql(
    resolveProjectId(options.projectId),
    `SELECT trait_name, COUNT(DISTINCT trait_value) AS value_count
FROM token_attributes
WHERE token_id LIKE '${escapeSqlValue(collectionPrefix)}'
GROUP BY trait_name
ORDER BY trait_name`,
  );

  return rows
    .map((row) => {
      const record = asRecord(row);
      if (!record) {
        return null;
      }

      const traitName = typeof record.trait_name === "string" ? record.trait_name : null;
      const valueCount = Number(record.value_count ?? 0);
      if (!traitName || !Number.isFinite(valueCount)) {
        return null;
      }

      return { traitName, valueCount };
    })
    .filter((row): row is { traitName: string; valueCount: number } => row !== null);
}

export function resolveCollectionProjectId(
  address: string,
  collections?: SeedCollection[],
) {
  const runtimeCollections = collections ?? getMarketplaceRuntimeConfig().collections;
  return runtimeCollections.find((collection) => collection.address === address)?.projectId;
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

export function collectionQueryOptions(options: CollectionSummaryOptions) {
  return queryOptions({
    queryKey: collectionQueryKey(options),
    queryFn: () => fetchCollection(options),
  });
}

export function collectionTokensQueryOptions(options: FetchCollectionTokensOptions) {
  return queryOptions({
    queryKey: collectionTokensQueryKey(options),
    queryFn: () => fetchCollectionTokens(options),
  });
}

export function collectionListingsQueryOptions(options: CollectionListingsOptions) {
  return queryOptions({
    queryKey: collectionListingsQueryKey(options),
    queryFn: () => fetchCollectionListings(options),
  });
}

export function collectionOrdersQueryOptions(options: CollectionOrdersOptions) {
  return queryOptions({
    queryKey: collectionOrdersQueryKey(options),
    queryFn: () => fetchCollectionOrders(options),
  });
}

export function traitNamesSummaryQueryOptions(options: {
  address: string;
  projectId?: string;
}) {
  return queryOptions({
    queryKey: traitNamesSummaryQueryKey(options),
    queryFn: () => fetchTraitNamesSummary(options),
  });
}
