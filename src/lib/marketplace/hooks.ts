"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  NormalizedToken,
  TokenDetails,
  TokenDetailsOptions,
} from "@cartridge/arcade/marketplace";
import { useMarketplaceTokenBalances } from "@cartridge/arcade/marketplace/react";
import { MARKETPLACE_CACHE_TTL_SECONDS } from "@/lib/marketplace/cache-policy";
import {
  normalizeAttributeFilters,
  normalizeTokenIds,
  stableCacheKey,
} from "@/lib/marketplace/cache-keys";
import {
  marketplaceApiGet,
  marketplaceReadParams,
} from "@/lib/marketplace/read-api";

type CollectionSummaryResult = {
  totalSupply?: string | number;
  metadata?: unknown;
} | null;

type CollectionTokensResult = {
  page?: {
    tokens?: NormalizedToken[];
    nextCursor?: string | null;
  } | null;
  error?: unknown;
} | null;

function logSdkPayload(label: string, options: object, payload: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const count = Array.isArray(payload)
    ? payload.length
    : Array.isArray((payload as { page?: { tokens?: unknown[] } })?.page?.tokens)
      ? (payload as { page: { tokens: unknown[] } }).page.tokens.length
      : undefined;
  const preview = Array.isArray(payload) ? payload.slice(0, 3) : payload;

  console.info(`[marketplace-api] ${label}`, {
    options,
    count,
    preview,
  });
}

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

export function useCollectionQuery(options: CollectionSummaryOptions) {
  return useQuery<CollectionSummaryResult>({
    queryKey: ["collection", options.address, options.projectId] as const,
    queryFn: async () => {
      const data = await marketplaceApiGet<CollectionSummaryResult>("/api/marketplace/collection", {
        address: options.address,
        projectId: options.projectId,
        fetchImages: options.fetchImages,
      });
      logSdkPayload("collection", options, data);
      return data;
    },
    enabled: !!options.address,
    staleTime: MARKETPLACE_CACHE_TTL_SECONDS.collection * 1000,
  });
}

export function useCollectionTokensQuery(
  options: FetchCollectionTokensOptions,
) {
  const normalizedTokenIds = normalizeTokenIds(options.tokenIds);
  const normalizedAttributeFilters = normalizeAttributeFilters(
    options.attributeFilters,
  );

  return useQuery<CollectionTokensResult>({
    queryKey: [
      "collection-tokens",
      options.address,
      options.project,
      options.cursor,
      normalizedTokenIds,
      options.limit,
      stableCacheKey(normalizedAttributeFilters ?? null),
    ] as const,
    queryFn: async () => {
      const normalizedParams = marketplaceReadParams({
        tokenIds: options.tokenIds,
        attributeFilters: options.attributeFilters,
      });
      const data = await marketplaceApiGet<CollectionTokensResult>(
        "/api/marketplace/collection-tokens",
        {
          address: options.address,
          project: options.project,
          cursor: options.cursor,
          limit: options.limit,
          fetchImages: options.fetchImages,
          tokenIds: normalizedParams.tokenIds,
          attributeFilters: normalizedParams.attributeFilters,
        },
      );
      logSdkPayload("collection-tokens", options, data);
      return data;
    },
    retry: (failureCount, error) => {
      if (isTransientCollectionTokenError(error)) {
        return failureCount < 2;
      }

      return failureCount < 1;
    },
    retryDelay: () => 0,
    enabled: !!options.address,
    staleTime: MARKETPLACE_CACHE_TTL_SECONDS.collection * 1000,
  });
}

export function useCollectionOrdersQuery(options: CollectionOrdersOptions) {
  return useQuery({
    queryKey: [
      "collection-orders",
      options.collection,
      options.status,
      options.category,
      options.tokenId,
    ] as const,
    queryFn: async () => {
      const data = await marketplaceApiGet<unknown[]>(
        "/api/marketplace/collection-orders",
        {
          collection: options.collection,
          status: options.status,
          category: options.category,
          tokenId: options.tokenId,
          limit: options.limit,
        },
      );
      logSdkPayload("collection-orders", options, data);
      return data;
    },
    enabled: !!options.collection,
    staleTime: MARKETPLACE_CACHE_TTL_SECONDS.collection * 1000,
  });
}

export function useCollectionListingsQuery(options: CollectionListingsOptions) {
  return useQuery({
    queryKey: [
      "collection-listings",
      options.collection,
      options.tokenId,
      options.projectId,
      options.verifyOwnership,
      options.limit,
    ] as const,
    queryFn: async () => {
      const data = await marketplaceApiGet<unknown[]>(
        "/api/marketplace/collection-listings",
        {
          collection: options.collection,
          tokenId: options.tokenId,
          projectId: options.projectId,
          verifyOwnership: options.verifyOwnership,
          limit: options.limit,
        },
      );
      logSdkPayload("collection-listings", options, data);
      return data;
    },
    enabled: !!options.collection,
    staleTime: MARKETPLACE_CACHE_TTL_SECONDS.collection * 1000,
  });
}

export function useTokenDetailQuery(options: TokenDetailsOptions) {
  return useQuery({
    queryKey: [
      "token-detail",
      options.collection,
      options.tokenId,
      options.projectId,
    ] as const,
    queryFn: async (): Promise<TokenDetails | null> => {
      const data = await marketplaceApiGet<TokenDetails | null>(
        "/api/marketplace/token-detail",
        {
          collection: options.collection,
          tokenId: options.tokenId,
          projectId: options.projectId,
          fetchImages: options.fetchImages,
        },
      );

      logSdkPayload("token-detail", options, data);
      return data;
    },
    enabled: !!options.collection && !!options.tokenId,
    staleTime: MARKETPLACE_CACHE_TTL_SECONDS.collection * 1000,
  });
}

export function useTokenOwnershipQuery(options: {
  collection: string;
  tokenId: string;
  accountAddress?: string;
}) {
  const alt = alternateTokenId(options.tokenId);
  const tokenIds = alt ? [options.tokenId, alt] : [options.tokenId];
  return useMarketplaceTokenBalances(
    {
      contractAddresses: [options.collection],
      accountAddresses: options.accountAddress ? [options.accountAddress] : [],
      tokenIds,
      limit: 1,
    },
    !!options.accountAddress && !!options.collection && !!options.tokenId,
  );
}

export function useCollectionTraitMetadataQuery(options: {
  address: string;
  projectId?: string;
}) {
  return useQuery({
    queryKey: ["collection-trait-metadata", options.address, options.projectId] as const,
    queryFn: async () => {
      return await marketplaceApiGet<
        Array<{ traitName: string; traitValue: string; count: number }>
      >("/api/marketplace/collection-trait-metadata", {
        address: options.address,
        projectId: options.projectId,
      });
    },
    enabled: !!options.address,
    staleTime: MARKETPLACE_CACHE_TTL_SECONDS.traitMetadata * 1000,
  });
}

export function useTokenHolderQuery(options: {
  collection: string;
  tokenId: string;
}) {
  const alt = alternateTokenId(options.tokenId);
  const tokenIds = alt ? [options.tokenId, alt] : [options.tokenId];
  return useMarketplaceTokenBalances(
    {
      contractAddresses: [options.collection],
      tokenIds,
      limit: 1,
    },
    !!options.collection && !!options.tokenId,
  );
}

export function useWalletPortfolioQuery(walletAddress: string | undefined) {
  return useMarketplaceTokenBalances(
    {
      accountAddresses: walletAddress ? [walletAddress] : [],
      limit: 200,
    },
    !!walletAddress,
  );
}
