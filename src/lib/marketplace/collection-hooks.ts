"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CollectionListingsOptions,
  CollectionOrdersOptions,
  CollectionSummaryOptions,
  FetchCollectionTokensOptions,
} from "@cartridge/arcade/marketplace";
import type { TraitSelection } from "@/lib/marketplace/traits";
import {
  collectionListingsQueryOptions,
  collectionOrdersQueryOptions,
  collectionQueryOptions,
  collectionTokensQueryOptions,
  traitNamesSummaryQueryOptions,
  traitValuesQueryOptions,
} from "@/lib/marketplace/collection-read-queries";

export function useCollectionQuery(options: CollectionSummaryOptions) {
  return useQuery({
    ...collectionQueryOptions(options),
    enabled: !!options.address,
  });
}

export function useCollectionOrdersQuery(options: CollectionOrdersOptions) {
  return useQuery({
    ...collectionOrdersQueryOptions(options),
    enabled: !!options.collection,
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

export function useCollectionListingsQuery(options: CollectionListingsOptions) {
  return useQuery({
    ...collectionListingsQueryOptions(options),
    enabled: !!options.collection,
  });
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
