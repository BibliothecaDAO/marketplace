"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  TokenDetails,
  TokenDetailsOptions,
} from "@cartridge/arcade/marketplace";
import { useMarketplaceClient, useMarketplaceTokenBalances } from "@cartridge/arcade/marketplace/react";

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

  console.info(`[marketplace-sdk] ${label}`, {
    options,
    count,
    preview,
  });
}

function hasUsableToken(data: TokenDetails | null): data is TokenDetails {
  return data !== null && data.token !== null && data.token !== undefined;
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
  const { client } = useMarketplaceClient();

  return useQuery({
    queryKey: ["collection", options.address, options.projectId] as const,
    queryFn: async () => {
      const data = await client!.getCollection(options);
      logSdkPayload("collection", options, data);
      return data;
    },
    enabled: !!client && !!options.address,
  });
}

export function useCollectionTokensQuery(
  options: FetchCollectionTokensOptions,
) {
  const { client } = useMarketplaceClient();

  return useQuery({
    queryKey: [
      "collection-tokens",
      options.address,
      options.project,
      options.cursor,
      options.tokenIds,
      options.limit,
    ] as const,
    queryFn: async () => {
      const data = await client!.listCollectionTokens(options);
      logSdkPayload("collection-tokens", options, data);
      return data;
    },
    enabled: !!client && !!options.address,
  });
}

export function useCollectionOrdersQuery(options: CollectionOrdersOptions) {
  const { client } = useMarketplaceClient();

  return useQuery({
    queryKey: [
      "collection-orders",
      options.collection,
      options.status,
      options.category,
      options.tokenId,
    ] as const,
    queryFn: async () => {
      const data = await client!.getCollectionOrders(options);
      logSdkPayload("collection-orders", options, data);
      return data;
    },
    enabled: !!client && !!options.collection,
  });
}

export function useCollectionListingsQuery(options: CollectionListingsOptions) {
  const { client } = useMarketplaceClient();

  return useQuery({
    queryKey: [
      "collection-listings",
      options.collection,
      options.tokenId,
      options.projectId,
      options.verifyOwnership,
    ] as const,
    queryFn: async () => {
      const data = await client!.listCollectionListings(options);
      logSdkPayload("collection-listings", options, data);
      return data;
    },
    enabled: !!client && !!options.collection,
  });
}

export function useTokenDetailQuery(options: TokenDetailsOptions) {
  const { client } = useMarketplaceClient();

  return useQuery({
    queryKey: [
      "token-detail",
      options.collection,
      options.tokenId,
      options.projectId,
    ] as const,
    queryFn: async (): Promise<TokenDetails | null> => {
      let data: TokenDetails | null = null;
      let initialError: unknown = null;

      try {
        data = await client!.getToken(options);
        logSdkPayload("token-detail", options, data);
      } catch (error) {
        initialError = error;
      }

      if (hasUsableToken(data)) {
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
        const fallbackData = await client!.getToken(fallbackOptions);
        logSdkPayload("token-detail-fallback", fallbackOptions, fallbackData);
        return fallbackData;
      } catch (fallbackError) {
        if (initialError) {
          throw initialError;
        }

        throw fallbackError;
      }
    },
    enabled: !!client && !!options.collection && !!options.tokenId,
  });
}

export function useTokenOwnershipQuery(options: {
  collection: string;
  tokenId: string;
  accountAddress?: string;
}) {
  return useMarketplaceTokenBalances(
    {
      contractAddresses: [options.collection],
      accountAddresses: options.accountAddress ? [options.accountAddress] : [],
      tokenIds: [options.tokenId],
      limit: 1,
    },
    !!options.accountAddress && !!options.collection && !!options.tokenId,
  );
}
