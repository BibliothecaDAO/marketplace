"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
} from "@cartridge/arcade/marketplace";
import {
  useMarketplaceTokenBalances,
} from "@cartridge/arcade/marketplace/react";
import {
  expandTokenIdVariants,
} from "@/lib/marketplace/token-id";
import type { TraitSelection } from "@/lib/marketplace/traits";
import {
  collectionListingsQueryOptions,
  collectionOrdersQueryOptions,
  collectionQueryOptions,
  collectionTokensQueryOptions,
  tokenBalancesQueryOptions,
  tokenDetailQueryOptions,
  traitNamesSummaryQueryOptions,
  traitValuesQueryOptions,
} from "@/lib/marketplace/read-queries";

export function useCollectionQuery(options: CollectionSummaryOptions) {
  return useQuery({
    ...collectionQueryOptions(options),
    enabled: !!options.address,
  });
}

export function useCollectionTokensQuery(
  options: FetchCollectionTokensOptions,
  queryOptions?: { enabled?: boolean; staleTime?: number },
) {
  const enabled = (queryOptions?.enabled ?? true) && !!options.address;
  return useQuery({
    ...collectionTokensQueryOptions(options),
    enabled,
    staleTime: queryOptions?.staleTime,
  });
}

export function useCollectionOrdersQuery(options: CollectionOrdersOptions) {
  return useQuery({
    ...collectionOrdersQueryOptions(options),
    enabled: !!options.collection,
  });
}

export function useCollectionListingsQuery(options: CollectionListingsOptions) {
  return useQuery({
    ...collectionListingsQueryOptions(options),
    enabled: !!options.collection,
  });
}

export function useTokenDetailQuery(options: {
  collection: string;
  tokenId: string;
  projectId?: string;
  fetchImages?: boolean;
}) {
  return useQuery({
    ...tokenDetailQueryOptions(options),
    enabled: !!options.collection && !!options.tokenId,
  });
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
    ...traitNamesSummaryQueryOptions(options),
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
    ...traitValuesQueryOptions(options),
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
  return useQuery({
    ...tokenBalancesQueryOptions({
      accountAddresses: walletAddress ? [walletAddress] : [],
      limit: 200,
    }),
    enabled: !!walletAddress,
  });
}
