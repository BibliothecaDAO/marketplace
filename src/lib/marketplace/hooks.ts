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
import type { TraitMetadataRow } from "@/lib/marketplace/traits";

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

async function listCollectionTokensResilient(
  client: NonNullable<ReturnType<typeof useMarketplaceClient>["client"]>,
  options: FetchCollectionTokensOptions,
) {
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
    const fallbackData = await client.listCollectionTokens(fallbackOptions);
    logSdkPayload("collection-tokens-fallback-no-images", fallbackOptions, fallbackData);
    return fallbackData;
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

type TraitMetadataApiPayload = {
  traitMetadata?: TraitMetadataRow[];
};

function traitMetadataRoutePath(options: { address: string; projectId?: string }) {
  const params = new URLSearchParams();
  if (options.projectId) {
    params.set("projectId", options.projectId);
  }

  const query = params.toString();
  const encodedAddress = encodeURIComponent(options.address);
  return query
    ? `/api/collections/${encodedAddress}/trait-metadata?${query}`
    : `/api/collections/${encodedAddress}/trait-metadata`;
}

async function fetchTraitMetadataFromRoute(options: {
  address: string;
  projectId?: string;
}): Promise<TraitMetadataRow[]> {
  const response = await fetch(traitMetadataRoutePath(options), {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).trim();
    } catch {
      // no-op: keep fallback message below
    }

    throw new Error(
      `failed to load trait metadata${detail ? `: ${detail}` : ""}`,
    );
  }

  const payload = (await response.json()) as TraitMetadataApiPayload;
  return Array.isArray(payload.traitMetadata) ? payload.traitMetadata : [];
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
      options.attributeFilters
        ? JSON.stringify(
            Object.fromEntries(
              Object.entries(options.attributeFilters).map(([k, v]) => [
                k,
                Array.from(v as Iterable<unknown>).sort(),
              ]),
            ),
          )
        : null,
    ] as const,
    queryFn: async () => {
      const data = await listCollectionTokensResilient(client!, options);
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
  const alt = alternateTokenId(options.tokenId);
  const tokenIds = alt ? [options.tokenId, alt] : [options.tokenId];
  return useMarketplaceTokenBalances(
    {
      contractAddresses: [options.collection],
      accountAddresses: options.accountAddress ? [options.accountAddress] : [],
      tokenIds,
      limit: 1,
    },
    {
      enabled: !!options.accountAddress && !!options.collection && !!options.tokenId,
    },
  );
}

export function useCollectionTraitMetadataQuery(options: {
  address: string;
  projectId?: string;
}) {
  return useQuery({
    queryKey: ["collection-trait-metadata", options.address, options.projectId] as const,
    queryFn: async () => fetchTraitMetadataFromRoute(options),
    enabled: !!options.address,
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
    {
      enabled: !!options.collection && !!options.tokenId,
    },
  );
}

export function useWalletPortfolioQuery(walletAddress: string | undefined) {
  return useMarketplaceTokenBalances(
    {
      accountAddresses: walletAddress ? [walletAddress] : [],
      limit: 200,
    },
    {
      enabled: !!walletAddress,
    },
  );
}
