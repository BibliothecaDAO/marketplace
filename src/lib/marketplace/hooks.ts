"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
  TokenDetailsOptions,
} from "@cartridge/arcade/marketplace";
import { useMarketplaceClient } from "@cartridge/arcade/marketplace/react";

export function useCollectionQuery(options: CollectionSummaryOptions) {
  const { client } = useMarketplaceClient();

  return useQuery({
    queryKey: ["collection", options.address, options.projectId] as const,
    queryFn: () => client!.getCollection(options),
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
    queryFn: () => client!.listCollectionTokens(options),
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
    queryFn: () => client!.getCollectionOrders(options),
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
    queryFn: () => client!.listCollectionListings(options),
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
    queryFn: () => client!.getToken(options),
    enabled: !!client && !!options.collection && !!options.tokenId,
  });
}
