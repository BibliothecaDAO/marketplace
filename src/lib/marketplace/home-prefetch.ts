import { dehydrate } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/marketplace/query-client";
import {
  getInitialHomeTokensOptions,
  homeCollectionListingsQueryOptions,
  homeCollectionQueryOptions,
  homeCollectionTokensQueryOptions,
  selectFeaturedHomeCollection,
} from "@/lib/marketplace/home-read-queries";

export async function buildHomePageHydrationState() {
  const queryClient = makeQueryClient();
  const featuredCollection = selectFeaturedHomeCollection();

  if (!featuredCollection) {
    return {
      featuredCollection: null,
      state: dehydrate(queryClient),
    };
  }

  const { address, projectId } = featuredCollection;

  await Promise.all([
    queryClient.prefetchQuery(
      homeCollectionQueryOptions({ address, projectId, fetchImages: true }),
    ),
    queryClient.prefetchQuery(
      homeCollectionTokensQueryOptions(
        getInitialHomeTokensOptions({ address, projectId }),
      ),
    ),
    queryClient.prefetchQuery(
      homeCollectionListingsQueryOptions({
        collection: address,
        projectId,
        limit: 100,
        verifyOwnership: false,
      }),
    ),
  ]);

  return {
    featuredCollection,
    state: dehydrate(queryClient),
  };
}
