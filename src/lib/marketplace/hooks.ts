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
  useMarketplaceToken,
  useMarketplaceTokenBalances,
} from "@cartridge/arcade/marketplace/react";
import {
  alternateTokenId,
  canonicalizeTokenId,
  expandTokenIdVariants,
} from "@/lib/marketplace/token-id";
import type { TraitSelection } from "@/lib/marketplace/traits";
import { aggregateTraitSummaryPages, aggregateTraitValuePages } from "@/lib/marketplace/traits";

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

export function useCollectionQuery(options: CollectionSummaryOptions) {
  return useMarketplaceCollection(options, {
    enabled: !!options.address,
  });
}

export function useCollectionTokensQuery(
  options: FetchCollectionTokensOptions,
  queryOptions?: { enabled?: boolean; staleTime?: number },
) {
  const enabled = (queryOptions?.enabled ?? true) && !!options.address;
  return useQuery({
    queryKey: [
      "collection-tokens",
      options.address,
      options.project,
      options.cursor,
      options.tokenIds,
      options.attributeFilters,
      options.limit,
    ] as const,
    queryFn: async () => {
      const { fetchCollectionTokens } = await import(
        "@cartridge/arcade/marketplace"
      );
      return fetchCollectionTokens(options);
    },
    enabled,
    staleTime: queryOptions?.staleTime,
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
  const canonicalTokenId = canonicalizeTokenId(tokenId);
  const paddedTokenId = canonicalTokenId
    ? `0x${canonicalTokenId.value.toString(16).padStart(64, "0")}`
    : null;
  const hasAlternateTokenId = !!altTokenId && altTokenId !== tokenId;
  const hasPaddedTokenId =
    !!paddedTokenId &&
    paddedTokenId !== tokenId &&
    paddedTokenId !== altTokenId;
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

  const shouldEnablePaddedQuery =
    enabled &&
    hasPaddedTokenId &&
    primaryQuery.status !== "pending" &&
    (primaryQuery.status === "error" || !hasUsableToken(primaryQuery.data)) &&
    (!hasAlternateTokenId ||
      (alternateQuery.status !== "pending" &&
        (alternateQuery.status === "error" || !hasUsableToken(alternateQuery.data))));

  const paddedQuery = useMarketplaceToken(
    {
      ...options,
      tokenId: hasPaddedTokenId ? paddedTokenId : tokenId,
    },
    {
      enabled: shouldEnablePaddedQuery,
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

  if (shouldEnablePaddedQuery) {
    if (hasUsableToken(paddedQuery.data)) {
      return paddedQuery;
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

  if (shouldEnablePaddedQuery) {
    return paddedQuery;
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

export function useTraitNamesSummaryQuery(options: {
  address: string;
  projectId?: string;
}) {
  return useQuery({
    queryKey: ["trait-names-summary", options.address, options.projectId] as const,
    queryFn: async () => {
      const { fetchTraitNamesSummary } = await import(
        "@cartridge/arcade/marketplace"
      );
      const result = await fetchTraitNamesSummary({
        address: options.address,
        defaultProjectId: options.projectId,
      });
      return aggregateTraitSummaryPages(result.pages);
    },
    enabled: !!options.address,
  });
}

export function useTraitValuesQuery(options: {
  address: string;
  traitName: string | null;
  otherTraitFilters?: TraitSelection[];
  projectId?: string;
}) {
  return useQuery({
    queryKey: [
      "trait-values",
      options.address,
      options.traitName,
      options.otherTraitFilters,
      options.projectId,
    ] as const,
    queryFn: async () => {
      if (!options.traitName) return [];
      const { fetchTraitValues } = await import(
        "@cartridge/arcade/marketplace"
      );
      const result = await fetchTraitValues({
        address: options.address,
        traitName: options.traitName,
        otherTraitFilters: options.otherTraitFilters,
        defaultProjectId: options.projectId,
      });
      return aggregateTraitValuePages(result.pages);
    },
    enabled: !!options.address && !!options.traitName,
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
