import { describe, expect, it } from "vitest";
import {
  MARKETPLACE_CACHE_TTL_SECONDS,
  cacheTtlForResource,
  type MarketplaceCacheResource,
} from "@/lib/marketplace/cache-policy";

describe("marketplace cache policy", () => {
  it("defines required ttl constants", () => {
    expect(MARKETPLACE_CACHE_TTL_SECONDS.collection).toBe(15);
    expect(MARKETPLACE_CACHE_TTL_SECONDS.traitMetadata).toBe(3600);
  });

  it("maps resources to expected ttl", () => {
    const collectionResources: MarketplaceCacheResource[] = [
      "collection",
      "collectionTokens",
      "collectionOrders",
      "collectionListings",
      "tokenDetail",
      "tokenFees",
    ];

    collectionResources.forEach((resource) => {
      expect(cacheTtlForResource(resource)).toBe(15);
    });

    expect(cacheTtlForResource("collectionTraitMetadata")).toBe(3600);
  });
});
