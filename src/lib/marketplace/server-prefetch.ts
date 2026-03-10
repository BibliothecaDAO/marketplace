import { QueryClient, dehydrate } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/marketplace/query-client";
import { groupPortfolioItemsByCollection, parsePortfolioItems } from "@/lib/marketplace/portfolio";
import {
  collectionQueryOptions,
  collectionTokensQueryOptions,
  getPortfolioTokenIds,
  resolveCollectionProjectId,
  tokenBalancesQueryOptions,
} from "@/lib/marketplace/read-queries";

async function prefetch(queryClient: QueryClient, tasks: Array<Promise<unknown>>) {
  await Promise.all(tasks);
  return dehydrate(queryClient);
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
