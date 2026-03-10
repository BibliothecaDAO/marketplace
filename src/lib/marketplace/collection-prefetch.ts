import { dehydrate } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/marketplace/query-client";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { cheapestListingByTokenId } from "@/features/cart/listing-utils";
import {
  collectionListingsQueryOptions,
  collectionOrdersQueryOptions,
  collectionQueryOptions,
  collectionTokensQueryOptions,
  getInitialCollectionTokensOptions,
  getInitialListedTokensOptions,
  resolveCollectionProjectId,
  traitNamesSummaryQueryOptions,
} from "@/lib/marketplace/collection-read-queries";

export async function buildCollectionPageHydrationState(options: {
  address: string;
  cursor?: string | null;
  activeFilters?: ActiveFilters;
}) {
  const queryClient = makeQueryClient();
  const projectId = resolveCollectionProjectId(options.address);
  const listingsOptions = {
    collection: options.address,
    projectId,
    limit: 100,
    verifyOwnership: false,
  } as const;
  const baseTokensOptions = getInitialCollectionTokensOptions({
    address: options.address,
    projectId,
    cursor: options.cursor,
    activeFilters: options.activeFilters,
  });

  await Promise.all([
    queryClient.prefetchQuery(
      collectionQueryOptions({
        address: options.address,
        projectId,
        fetchImages: true,
      }),
    ),
    queryClient.prefetchQuery(
      traitNamesSummaryQueryOptions({
        address: options.address,
        projectId,
      }),
    ),
    queryClient.prefetchQuery(collectionListingsQueryOptions(listingsOptions)),
    queryClient.prefetchQuery(collectionTokensQueryOptions(baseTokensOptions)),
    queryClient.prefetchQuery(
      collectionOrdersQueryOptions({
        collection: options.address,
        limit: 24,
      }),
    ),
    queryClient.prefetchQuery(
      collectionListingsQueryOptions({
        collection: options.address,
        projectId,
        limit: 24,
        verifyOwnership: false,
      }),
    ),
  ]);

  const listingData = queryClient.getQueryData(
    collectionListingsQueryOptions(listingsOptions).queryKey,
  );
  const listedTokenIds = cheapestListingByTokenId(Array.isArray(listingData) ? listingData : []).keys();
  const listedTokensOptions = getInitialListedTokensOptions({
    address: options.address,
    projectId,
    listedTokenIds,
    activeFilters: options.activeFilters,
  });

  if (listedTokensOptions.tokenIds && listedTokensOptions.tokenIds.length > 0) {
    await queryClient.prefetchQuery(collectionTokensQueryOptions(listedTokensOptions));
  }

  return {
    state: dehydrate(queryClient),
  };
}
