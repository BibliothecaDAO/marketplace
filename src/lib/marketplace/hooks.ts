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
import {
  alternateTokenId,
  expandTokenIdVariants,
} from "@/lib/marketplace/token-id";
import type { TraitMetadataRow } from "@/lib/marketplace/traits";

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

export function useCollectionTokensQuery(
  options: FetchCollectionTokensOptions,
  queryOptions?: { enabled?: boolean },
) {
  return useMarketplaceCollectionTokens(options, {
    enabled: (queryOptions?.enabled ?? true) && !!options.address,
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
  const scopedTokenIdCandidates = collectionScopedTokenIdCandidates(
    options.collection,
    tokenId,
  );
  const scopedPrimaryTokenId = scopedTokenIdCandidates[0] ?? tokenId;
  const scopedSecondaryTokenId = scopedTokenIdCandidates[1] ?? scopedPrimaryTokenId;
  const hasScopedPrimaryTokenId = scopedPrimaryTokenId !== tokenId;
  const hasScopedSecondaryTokenId =
    scopedSecondaryTokenId !== scopedPrimaryTokenId &&
    scopedSecondaryTokenId !== tokenId &&
    scopedSecondaryTokenId !== altTokenId;

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

  const shouldEnableScopedPrimaryQuery =
    enabled &&
    hasScopedPrimaryTokenId &&
    primaryQuery.status !== "pending" &&
    (primaryQuery.status === "error" || !hasUsableToken(primaryQuery.data)) &&
    (!hasAlternateTokenId ||
      (alternateQuery.status !== "pending" &&
        (alternateQuery.status === "error" || !hasUsableToken(alternateQuery.data))));

  const scopedPrimaryQuery = useMarketplaceToken(
    {
      ...options,
      tokenId: scopedPrimaryTokenId,
    },
    {
      enabled: shouldEnableScopedPrimaryQuery,
    },
  );

  const shouldEnableScopedSecondaryQuery =
    shouldEnableScopedPrimaryQuery &&
    hasScopedSecondaryTokenId &&
    scopedPrimaryQuery.status !== "pending" &&
    (scopedPrimaryQuery.status === "error" || !hasUsableToken(scopedPrimaryQuery.data));

  const scopedSecondaryQuery = useMarketplaceToken(
    {
      ...options,
      tokenId: scopedSecondaryTokenId,
    },
    {
      enabled: shouldEnableScopedSecondaryQuery,
    },
  );

  if (hasUsableToken(primaryQuery.data)) {
    return primaryQuery;
  }

  if (shouldEnableAlternateQuery) {
    if (hasUsableToken(alternateQuery.data)) {
      return alternateQuery;
    }
  }

  if (shouldEnableScopedPrimaryQuery) {
    if (hasUsableToken(scopedPrimaryQuery.data)) {
      return scopedPrimaryQuery;
    }
  }

  if (shouldEnableScopedSecondaryQuery) {
    return scopedSecondaryQuery;
  }

  if (shouldEnableScopedPrimaryQuery) {
    return scopedPrimaryQuery;
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
  const tokenIds = expandTokenIdVariants([options.tokenId]);
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
  const tokenIds = expandTokenIdVariants([options.tokenId]);
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
