import { QueryClient, dehydrate } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/marketplace/query-client";
import { groupPortfolioItemsByCollection, parsePortfolioItems } from "@/lib/marketplace/portfolio";
import {
  collectionListingsQueryOptions,
  collectionOrdersQueryOptions,
  collectionQueryOptions,
  collectionTokensQueryOptions,
  getPortfolioTokenIds,
  getInitialCollectionTokensOptions,
  getInitialListedTokensOptions,
  resolveCollectionProjectId,
  tokenBalancesQueryOptions,
  traitNamesSummaryQueryOptions,
} from "@/lib/marketplace/read-queries";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { cheapestListingByTokenId } from "@/features/cart/listing-utils";

async function prefetch(queryClient: QueryClient, tasks: Array<Promise<unknown>>) {
  await Promise.all(tasks);
  return dehydrate(queryClient);
}

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

export async function buildWalletProfileHydrationState(address: string) {
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery(
    tokenBalancesQueryOptions({
      accountAddresses: [address],
      limit: 200,
    }),
  );

  const portfolioQuery = tokenBalancesQueryOptions({
    accountAddresses: [address],
    limit: 200,
  });
  const portfolioData = queryClient.getQueryData(portfolioQuery.queryKey);
  const groupedCollections = groupPortfolioItemsByCollection(
    parsePortfolioItems(portfolioData),
  );

  await Promise.all(
    groupedCollections.flatMap(({ collectionAddress, tokenIds }) => {
      const projectId = resolveCollectionProjectId(collectionAddress);
      const portfolioTokenIds = getPortfolioTokenIds(tokenIds);
      return [
        queryClient.prefetchQuery(
          collectionQueryOptions({ address: collectionAddress, projectId, fetchImages: true }),
        ),
        queryClient.prefetchQuery(
          collectionTokensQueryOptions({
            address: collectionAddress,
            project: projectId,
            tokenIds: portfolioTokenIds,
            limit: portfolioTokenIds.length,
            fetchImages: true,
          }),
        ),
      ];
    }),
  );

  return {
    state: dehydrate(queryClient),
  };
}

export async function buildPortfolioPageHydrationState(address?: string) {
  if (!address) {
    return {
      state: dehydrate(makeQueryClient()),
    };
  }

  return buildWalletProfileHydrationState(address);
}
