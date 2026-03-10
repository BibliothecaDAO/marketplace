import { dehydrate } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/marketplace/query-client";
import {
  resolveCollectionProjectId,
  tokenDetailQueryOptions,
  tokenListingsQueryOptions,
} from "@/lib/marketplace/token-read-queries";

export async function buildTokenPageHydrationState(options: {
  address: string;
  tokenId: string;
}) {
  const queryClient = makeQueryClient();
  const projectId = resolveCollectionProjectId(options.address);

  await Promise.all([
    queryClient.prefetchQuery(
      tokenDetailQueryOptions({
        collection: options.address,
        tokenId: options.tokenId,
        projectId,
        fetchImages: true,
      }),
    ),
    queryClient.prefetchQuery(
      tokenListingsQueryOptions({
        collection: options.address,
        tokenId: options.tokenId,
        projectId,
        limit: 50,
        verifyOwnership: true,
      }),
    ),
  ]);

  return {
    state: dehydrate(queryClient),
  };
}
