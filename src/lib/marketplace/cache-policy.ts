export const MARKETPLACE_CACHE_TTL_SECONDS = {
  collection: 15,
  traitMetadata: 60 * 60,
} as const;

export type MarketplaceCacheResource =
  | "collection"
  | "collectionTokens"
  | "collectionOrders"
  | "collectionListings"
  | "tokenDetail"
  | "tokenFees"
  | "collectionTraitMetadata";

export function cacheTtlForResource(resource: MarketplaceCacheResource) {
  if (resource === "collectionTraitMetadata") {
    return MARKETPLACE_CACHE_TTL_SECONDS.traitMetadata;
  }

  return MARKETPLACE_CACHE_TTL_SECONDS.collection;
}
