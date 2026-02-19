import "server-only";

import { unstable_cache } from "next/cache";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  TokenDetails,
  TokenDetailsOptions,
} from "@cartridge/arcade/marketplace";
import { cacheTtlForResource } from "@/lib/marketplace/cache-policy";
import {
  normalizeAttributeFilters,
  normalizeTokenIds,
  stableCacheKey,
} from "@/lib/marketplace/cache-keys";
import { calculateMarketplaceFee, parseBigInt } from "@/lib/marketplace/fees";
import { formatNumberish } from "@/lib/marketplace/token-display";
import { getServerMarketplaceClient } from "@/lib/marketplace/server-client";

type TraitMetadata = {
  traitName: string;
  traitValue: string;
  count: number;
};

export type TokenFeesResult = {
  marketplaceFee: string;
  royaltyFee: string;
  total: string;
};

const DEFAULT_MARKETPLACE_FEE_NUM = 500;
const DEFAULT_MARKETPLACE_FEE_DENOMINATOR = 10_000;

function errorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isTransientCollectionTokenError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("invalid content type: application/json") ||
    message.includes("deadline exceeded") ||
    message.includes("request timeout") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

async function listCollectionTokensResilient(options: FetchCollectionTokensOptions) {
  const client = await getServerMarketplaceClient();

  try {
    return await client.listCollectionTokens(options);
  } catch (initialError) {
    const shouldRetryWithoutImages =
      options.fetchImages === true &&
      isTransientCollectionTokenError(initialError);
    if (!shouldRetryWithoutImages) {
      throw initialError;
    }

    const fallbackOptions = { ...options, fetchImages: false };
    return await client.listCollectionTokens(fallbackOptions);
  }
}

function alternateTokenId(rawTokenId: string) {
  const tokenId = rawTokenId.trim();
  if (!tokenId) {
    return null;
  }

  if (/^0x[0-9a-fA-F]+$/.test(tokenId)) {
    try {
      return BigInt(tokenId).toString();
    } catch {
      return null;
    }
  }

  if (/^\d+$/.test(tokenId)) {
    try {
      return `0x${BigInt(tokenId).toString(16)}`;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeFetchCollectionTokensOptions(options: FetchCollectionTokensOptions) {
  const normalizedTokenIds = normalizeTokenIds(options.tokenIds);
  const normalizedAttributeFilters = normalizeAttributeFilters(options.attributeFilters);

  const attributeFilters = normalizedAttributeFilters
    ? Object.fromEntries(
        Object.entries(normalizedAttributeFilters).map(([key, values]) => [
          key,
          new Set(values),
        ]),
      )
    : undefined;

  return {
    ...options,
    tokenIds: normalizedTokenIds.length > 0 ? normalizedTokenIds : undefined,
    attributeFilters,
  } satisfies FetchCollectionTokensOptions;
}

const getCollectionCached = unstable_cache(
  async (
    _cacheKey: string,
    options: CollectionSummaryOptions,
  ): Promise<unknown> => {
    const client = await getServerMarketplaceClient();
    return await client.getCollection(options);
  },
  ["marketplace", "collection"],
  { revalidate: cacheTtlForResource("collection") },
);

const getCollectionTokensCached = unstable_cache(
  async (
    _cacheKey: string,
    options: FetchCollectionTokensOptions,
  ): Promise<unknown> => {
    return await listCollectionTokensResilient(options);
  },
  ["marketplace", "collection-tokens"],
  { revalidate: cacheTtlForResource("collectionTokens") },
);

const getCollectionOrdersCached = unstable_cache(
  async (
    _cacheKey: string,
    options: CollectionOrdersOptions,
  ): Promise<unknown[]> => {
    const client = await getServerMarketplaceClient();
    return await client.getCollectionOrders(options);
  },
  ["marketplace", "collection-orders"],
  { revalidate: cacheTtlForResource("collectionOrders") },
);

const getCollectionListingsCached = unstable_cache(
  async (
    _cacheKey: string,
    options: CollectionListingsOptions,
  ): Promise<unknown[]> => {
    const client = await getServerMarketplaceClient();
    return await client.listCollectionListings(options);
  },
  ["marketplace", "collection-listings"],
  { revalidate: cacheTtlForResource("collectionListings") },
);

const getTokenDetailCached = unstable_cache(
  async (
    _cacheKey: string,
    options: TokenDetailsOptions,
  ): Promise<TokenDetails | null> => {
    const client = await getServerMarketplaceClient();
    let data: TokenDetails | null = null;
    let initialError: unknown = null;

    try {
      data = await client.getToken(options);
    } catch (error) {
      initialError = error;
    }

    if (data?.token) {
      return data;
    }

    const fallbackTokenId = alternateTokenId(String(options.tokenId));
    if (!fallbackTokenId || fallbackTokenId === String(options.tokenId)) {
      if (initialError) {
        throw initialError;
      }
      return data;
    }

    const fallbackOptions = {
      ...options,
      tokenId: fallbackTokenId,
    };

    try {
      return await client.getToken(fallbackOptions);
    } catch (fallbackError) {
      if (initialError) {
        throw initialError;
      }

      throw fallbackError;
    }
  },
  ["marketplace", "token-detail"],
  { revalidate: cacheTtlForResource("tokenDetail") },
);

const getCollectionTraitMetadataCached = unstable_cache(
  async (
    _cacheKey: string,
    options: { address: string; projectId?: string },
  ): Promise<TraitMetadata[]> => {
    const { fetchCollectionTraitMetadata, aggregateTraitMetadata } =
      await import("@cartridge/arcade/marketplace");

    const result = await fetchCollectionTraitMetadata({
      address: options.address,
      projects: options.projectId ? [options.projectId] : undefined,
      defaultProjectId: options.projectId,
    });

    return aggregateTraitMetadata(result.pages);
  },
  ["marketplace", "collection-trait-metadata"],
  { revalidate: cacheTtlForResource("collectionTraitMetadata") },
);

const getTokenFeesCached = unstable_cache(
  async (
    _cacheKey: string,
    options: { collection: string; tokenId: string; amount: string },
  ): Promise<TokenFeesResult> => {
    const amount = parseBigInt(options.amount);
    if (amount === null) {
      throw new Error("Invalid amount.");
    }

    const client = await getServerMarketplaceClient();
    const fees =
      typeof client.getFees === "function" ? await client.getFees() : null;
    const marketplaceFee = calculateMarketplaceFee(amount, {
      feeNum: fees?.feeNum ?? DEFAULT_MARKETPLACE_FEE_NUM,
      feeDenominator: fees?.feeDenominator ?? DEFAULT_MARKETPLACE_FEE_DENOMINATOR,
    });

    const royaltyResponse =
      typeof client.getRoyaltyFee === "function"
        ? await client.getRoyaltyFee({
            collection: options.collection,
            tokenId: formatNumberish(options.tokenId) ?? options.tokenId,
            amount,
          })
        : null;

    const royaltyFee = royaltyResponse?.amount ?? BigInt(0);

    return {
      marketplaceFee: marketplaceFee.toString(),
      royaltyFee: royaltyFee.toString(),
      total: (amount + marketplaceFee + royaltyFee).toString(),
    };
  },
  ["marketplace", "token-fees"],
  { revalidate: cacheTtlForResource("tokenFees") },
);

export function cacheControlHeader(resource: Parameters<typeof cacheTtlForResource>[0]) {
  const ttl = cacheTtlForResource(resource);
  return `s-maxage=${ttl}, stale-while-revalidate=${ttl}`;
}

export async function getCachedCollection(options: CollectionSummaryOptions) {
  return await getCollectionCached(stableCacheKey(options), options);
}

export async function getCachedCollectionTokens(options: FetchCollectionTokensOptions) {
  const normalized = normalizeFetchCollectionTokensOptions(options);
  return await getCollectionTokensCached(stableCacheKey(normalized), normalized);
}

export async function getCachedCollectionOrders(options: CollectionOrdersOptions) {
  return await getCollectionOrdersCached(stableCacheKey(options), options);
}

export async function getCachedCollectionListings(options: CollectionListingsOptions) {
  return await getCollectionListingsCached(stableCacheKey(options), options);
}

export async function getCachedTokenDetail(options: TokenDetailsOptions) {
  return await getTokenDetailCached(stableCacheKey(options), options);
}

export async function getCachedCollectionTraitMetadata(options: {
  address: string;
  projectId?: string;
}) {
  return await getCollectionTraitMetadataCached(stableCacheKey(options), options);
}

export async function getCachedTokenFees(options: {
  collection: string;
  tokenId: string;
  amount: string;
}) {
  return await getTokenFeesCached(stableCacheKey(options), options);
}
