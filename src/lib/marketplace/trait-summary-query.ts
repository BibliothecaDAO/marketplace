import { queryOptions } from "@tanstack/react-query";
import {
  type TraitNameSummary,
} from "@/lib/marketplace/traits";
import { getMarketplaceApiClient } from "@/lib/marketplace/api-client";

export const TRAIT_SUMMARY_STALE_TIME_MS = 60_000;

export type TraitNamesSummaryQueryInput = {
  address: string;
  projectId?: string;
};

export function traitNamesSummaryQueryKey(options: TraitNamesSummaryQueryInput) {
  return ["trait-names-summary", options.address] as const;
}

export async function fetchTraitNamesSummaryAggregate(
  options: TraitNamesSummaryQueryInput,
): Promise<TraitNameSummary[]> {
  const response = await getMarketplaceApiClient().traits(options.address);
  return response.data.map((facet) => ({
    traitName: facet.name,
    valueCount: facet.values.length,
  }));
}

export function traitNamesSummaryQueryOptions(options: TraitNamesSummaryQueryInput) {
  return queryOptions({
    queryKey: traitNamesSummaryQueryKey(options),
    queryFn: () => fetchTraitNamesSummaryAggregate(options),
    staleTime: TRAIT_SUMMARY_STALE_TIME_MS,
  });
}
