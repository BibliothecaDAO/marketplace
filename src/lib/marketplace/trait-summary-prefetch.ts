import type { QueryClient } from "@tanstack/react-query";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  TRAIT_SUMMARY_STALE_TIME_MS,
  fetchTraitNamesSummaryAggregate,
  traitNamesSummaryQueryKey,
  type TraitNamesSummaryQueryInput,
} from "@/lib/marketplace/trait-summary-query";

const fetchCachedTraitNamesSummary = unstable_cache(
  async (address: string, projectId?: string) =>
    fetchTraitNamesSummaryAggregate({ address, projectId }),
  ["trait-names-summary"],
  {
    revalidate: TRAIT_SUMMARY_STALE_TIME_MS / 1000,
  },
);

const fetchServerTraitNamesSummary = cache(
  async (address: string, projectId?: string) =>
    fetchCachedTraitNamesSummary(address, projectId),
);

export async function prefetchTraitNamesSummary(
  queryClient: QueryClient,
  options: TraitNamesSummaryQueryInput,
) {
  await queryClient.prefetchQuery({
    queryKey: traitNamesSummaryQueryKey(options),
    queryFn: () => fetchServerTraitNamesSummary(options.address, options.projectId),
    staleTime: TRAIT_SUMMARY_STALE_TIME_MS,
  });
}
