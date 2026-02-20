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
import {
  useMarketplaceCollection,
  useMarketplaceCollectionListings,
  useMarketplaceCollectionOrders,
  useMarketplaceCollectionTokens,
  useMarketplaceToken,
  useMarketplaceTokenBalances,
} from "@cartridge/arcade/marketplace/react";
import type { TraitMetadataRow } from "@/lib/marketplace/traits";

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

function hasUsableToken(data: TokenDetails | null | undefined): data is TokenDetails {
  return data !== null && data !== undefined && data.token !== null && data.token !== undefined;
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
  return useMarketplaceCollection(options, {
    enabled: !!options.address,
  });
}

export function useCollectionTokensQuery(options: FetchCollectionTokensOptions) {
  return useMarketplaceCollectionTokens(options, {
    enabled: !!options.address,
  });
}

export function useCollectionOrdersQuery(options: CollectionOrdersOptions) {
  return useMarketplaceCollectionOrders(options, {
    enabled: !!options.collection,
  });
}

export function useCollectionListingsQuery(options: CollectionListingsOptions) {
  return useMarketplaceCollectionListings(options, {
    enabled: !!options.collection,
  });
}

export function useTokenDetailQuery(options: TokenDetailsOptions) {
  const tokenId = String(options.tokenId);
  const enabled = !!options.collection && !!tokenId;
  const altTokenId = alternateTokenId(tokenId);
  const hasAlternateTokenId = !!altTokenId && altTokenId !== tokenId;

  const primaryQuery = useMarketplaceToken(options, {
    enabled,
  });

  const shouldEnableAlternateQuery =
    enabled
    && hasAlternateTokenId
    && primaryQuery.status !== "pending"
    && (primaryQuery.status === "error" || !hasUsableToken(primaryQuery.data));

  const alternateQuery = useMarketplaceToken(
    {
      ...options,
      tokenId: hasAlternateTokenId ? altTokenId : tokenId,
    },
    {
      enabled: shouldEnableAlternateQuery,
    },
  );

  if (hasUsableToken(primaryQuery.data)) {
    return primaryQuery;
  }

  if (shouldEnableAlternateQuery) {
    return alternateQuery;
  }

  return primaryQuery;
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
