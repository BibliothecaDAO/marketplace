import { unstable_cache } from "next/cache";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { alternateTokenId, canonicalizeTokenId } from "@/lib/marketplace/token-id";
import { tokenImage, tokenName } from "@/lib/marketplace/token-display";

const COLLECTION_CACHE_REVALIDATE_SECONDS = 300;
const TOKEN_CACHE_REVALIDATE_SECONDS = 60;
const DEFAULT_PROJECT_ID = "arcade-main";

type TokenLike = {
  token_id?: unknown;
  image?: unknown;
  metadata?: unknown;
};

type TokenDetailsLike = {
  token?: TokenLike | null;
} | null;

type CollectionSeoData = {
  exists: boolean;
  name: string;
  description: string | null;
  image: string | null;
};

type TokenSeoData = {
  exists: boolean;
  tokenName: string;
  collectionName: string;
  description: string | null;
  image: string | null;
  collectionImage: string | null;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeImageUrl(value: unknown) {
  const source = asNonEmptyString(value);
  if (!source) {
    return null;
  }

  if (/^https?:\/\//i.test(source)) {
    return source;
  }

  if (source.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${source.slice("ipfs://".length)}`;
  }

  return null;
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

function resolveCollectionContext(address: string) {
  const config = getMarketplaceRuntimeConfig();
  const knownCollection = config.collections.find(
    (entry) => entry.address.toLowerCase() === address.toLowerCase(),
  );

  return {
    name: knownCollection?.name ?? address,
    projectId: knownCollection?.projectId,
  };
}

function resolveProjectId(projectId?: string) {
  const { sdkConfig } = getMarketplaceRuntimeConfig();
  return projectId ?? sdkConfig.defaultProject ?? DEFAULT_PROJECT_ID;
}

function collectionMetadata(rawCollection: unknown) {
  const fields = asRecord(rawCollection);
  const metadata = asRecord(fields?.metadata);

  const name = asNonEmptyString(metadata?.name);
  const description = asNonEmptyString(metadata?.description);
  const image =
    normalizeImageUrl(fields?.image) ??
    normalizeImageUrl(metadata?.image) ??
    normalizeImageUrl(metadata?.image_url);

  return {
    name,
    description,
    image,
  };
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

function tokenCandidates(rawTokenId: string) {
  const candidates = new Set<string>();
  const tokenId = rawTokenId.trim();
  if (tokenId) {
    candidates.add(tokenId);
  }

  const alternate = alternateTokenId(rawTokenId);
  if (alternate) {
    candidates.add(alternate);
  }

  const canonical = canonicalizeTokenId(rawTokenId);
  if (canonical) {
    candidates.add(`0x${canonical.value.toString(16).padStart(64, "0")}`);
  }

  return Array.from(candidates);
}

async function _fetchCollectionUncached(address: string) {
  const context = resolveCollectionContext(address);
  const normalizedAddress = normalizePaddedAddress(address) ?? address;

  try {
    const collectionRows = await fetchToriiSql(
      resolveProjectId(context.projectId),
      `SELECT contract_address, metadata, total_supply
FROM token_contracts
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedAddress)}')
LIMIT 1`,
    );
    const collection = asRecord(collectionRows[0]);
    if (!collection) {
      return {
        context,
        collection: null,
      };
    }

    let metadata = parseJsonSafe(collection.metadata);
    if (!metadata) {
      const tokenRows = await fetchToriiSql(
        resolveProjectId(context.projectId),
        `SELECT metadata
FROM tokens
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedAddress)}')
LIMIT 1`,
      );
      metadata = parseJsonSafe(asRecord(tokenRows[0])?.metadata);
    }

    return {
      context,
      collection: {
        address,
        metadata,
        totalSupply: collection.total_supply,
      },
    };
  } catch {
    return {
      context,
      collection: null,
    };
  }
}

const fetchCollectionCached = unstable_cache(
  _fetchCollectionUncached,
  ["seo-collection"],
  { revalidate: COLLECTION_CACHE_REVALIDATE_SECONDS },
);

const collectionPromiseCache = new Map<string, ReturnType<typeof fetchCollectionCached>>();

function fetchCollection(address: string) {
  const cached = collectionPromiseCache.get(address);
  if (cached) {
    return cached;
  }

  const next = fetchCollectionCached(address);
  collectionPromiseCache.set(address, next);
  return next;
}

async function _fetchTokenWithFallbackUncached(options: {
  collection: string;
  tokenId: string;
  projectId?: string;
}) {
  const normalizedCollection = normalizePaddedAddress(options.collection) ?? options.collection;
  const projectId = resolveProjectId(options.projectId);

  try {
    for (const candidate of tokenCandidates(options.tokenId)) {
      const tokenRows = await fetchToriiSql(
        projectId,
        `SELECT contract_address, token_id, metadata
FROM tokens
WHERE lower(contract_address) = lower('${escapeSqlValue(normalizedCollection)}')
  AND token_id = '${escapeSqlValue(candidate)}'
LIMIT 1`,
      );
      const tokenRecord = asRecord(tokenRows[0]);
      if (!tokenRecord) {
        continue;
      }

      const token: TokenLike = {
        token_id: tokenRecord.token_id,
        metadata: parseJsonSafe(tokenRecord.metadata),
        image: normalizeImageUrl(parseJsonSafe(tokenRecord.metadata)?.image) ??
          normalizeImageUrl(parseJsonSafe(tokenRecord.metadata)?.image_url),
      };

      return { token } satisfies TokenDetailsLike;
    }
  } catch {
    return null;
  }

  return null;
}

const fetchTokenWithFallbackCached = unstable_cache(
  (collection: string, tokenId: string, projectId?: string) =>
    _fetchTokenWithFallbackUncached({ collection, tokenId, projectId }),
  ["seo-token"],
  { revalidate: TOKEN_CACHE_REVALIDATE_SECONDS },
);

const tokenPromiseCache = new Map<string, ReturnType<typeof fetchTokenWithFallbackCached>>();

function fetchTokenWithFallback(options: {
  collection: string;
  tokenId: string;
  projectId?: string;
}) {
  const key = `${options.collection}:${options.tokenId}:${options.projectId ?? ""}`;
  const cached = tokenPromiseCache.get(key);
  if (cached) {
    return cached;
  }

  const next = fetchTokenWithFallbackCached(
    options.collection,
    options.tokenId,
    options.projectId,
  );
  tokenPromiseCache.set(key, next);
  return next;
}

function normalizedTokenImage(token: TokenLike) {
  return normalizeImageUrl(tokenImage(token as never));
}

export async function getCollectionSeoData(address: string): Promise<CollectionSeoData> {
  const { context, collection } = await fetchCollection(address);

  if (!collection) {
    return {
      exists: false,
      name: context.name,
      description: null,
      image: null,
    };
  }

  const metadata = collectionMetadata(collection);

  return {
    exists: true,
    name: metadata.name ?? context.name,
    description: metadata.description,
    image: metadata.image,
  };
}

export async function getTokenSeoData(
  address: string,
  tokenId: string,
): Promise<TokenSeoData> {
  const context = resolveCollectionContext(address);
  const rawCollectionPromise = fetchCollection(address);
  const tokenDetailPromise = fetchTokenWithFallback({
    collection: address,
    tokenId,
    projectId: context.projectId,
  });
  const [{ collection: rawCollection }, tokenDetail] = await Promise.all([
    rawCollectionPromise,
    tokenDetailPromise,
  ]);

  const collectionInfo = collectionMetadata(rawCollection);
  const collectionName = collectionInfo.name ?? context.name;
  const collectionImage = collectionInfo.image;

  if (!tokenDetail?.token) {
    return {
      exists: false,
      tokenName: `Token #${tokenId}`,
      collectionName,
      description: null,
      image: null,
      collectionImage,
    };
  }

  const resolvedTokenName = tokenName(tokenDetail.token as never);

  return {
    exists: true,
    tokenName: resolvedTokenName,
    collectionName,
    description:
      asNonEmptyString(asRecord(tokenDetail.token.metadata)?.description) ??
      `View listings and activity for ${resolvedTokenName}.`,
    image: normalizedTokenImage(tokenDetail.token),
    collectionImage,
  };
}
