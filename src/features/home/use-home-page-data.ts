"use client";

import { useMemo, useState } from "react";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import {
  useCollectionListingsQuery,
  useCollectionQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
  formatPriceForDisplay,
  formatNumberish,
  tokenImage,
  tokenName,
} from "@/lib/marketplace/token-display";
import { COLLECTION_LISTING_SAMPLE_LIMIT } from "@/lib/marketplace/query-limits";
import { cheapestListingByTokenId } from "@/features/cart/listing-utils";
import type {
  CollectionCardData,
  FeaturedCollection,
  SidebarCollection,
  TrendingToken,
} from "@/features/home/types";

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function metadataName(metadata: unknown): string | null {
  const fields = asRecord(metadata);
  if (!fields) {
    return null;
  }

  const name = fields.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function metadataImage(metadata: unknown): string | null {
  const fields = asRecord(metadata);
  if (!fields) {
    return null;
  }

  const image = fields.image ?? fields.image_url;
  return typeof image === "string" && image.trim() ? image : null;
}

function floorPriceFromListings(
  cheapestListings: Map<string, { price: string; currency: string }>,
): { price: string; currency: string | null } | null {
  let minPrice: bigint | null = null;
  let minCurrency: string | null = null;

  for (const listing of cheapestListings.values()) {
    try {
      const parsed = BigInt(listing.price);
      if (minPrice === null || parsed < minPrice) {
        minPrice = parsed;
        minCurrency = listing.currency ?? null;
      }
    } catch {
      // Ignore malformed values.
    }
  }

  if (minPrice === null) {
    return null;
  }

  const formatted = formatPriceForDisplay(minPrice.toString());
  if (!formatted) {
    return null;
  }

  return {
    price: formatted,
    currency: minCurrency,
  };
}

function sortablePrice(value: string | null | undefined): bigint | null {
  if (!value) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function useHomePageData() {
  const { collections } = getMarketplaceRuntimeConfig();
  const [featuredIndex] = useState(() => {
    if (collections.length === 0) {
      return 0;
    }

    return Math.floor(Math.random() * collections.length);
  });

  const featuredSeed = collections[featuredIndex] ?? null;
  const featuredAddress = featuredSeed?.address ?? "";
  const featuredProjectId = featuredSeed?.projectId;

  const collectionQuery = useCollectionQuery({
    address: featuredAddress,
    projectId: featuredProjectId,
    fetchImages: true,
  });
  const tokensQuery = useCollectionTokensQuery({
    address: featuredAddress,
    project: featuredProjectId,
    limit: 12,
    fetchImages: true,
  });
  const listingsQuery = useCollectionListingsQuery({
    collection: featuredAddress,
    projectId: featuredProjectId,
    limit: COLLECTION_LISTING_SAMPLE_LIMIT,
    verifyOwnership: true,
  });

  const cheapestListings = useMemo(
    () => cheapestListingByTokenId(listingsQuery.data),
    [listingsQuery.data],
  );

  const resolvedFloor = useMemo(
    () => floorPriceFromListings(cheapestListings),
    [cheapestListings],
  );

  const listingCount = useMemo(() => {
    if (!Array.isArray(listingsQuery.data)) {
      return null;
    }

    return String(listingsQuery.data.length);
  }, [listingsQuery.data]);

  const featuredTokenImage = useMemo(() => {
    const tokens = tokensQuery.data?.page?.tokens ?? [];
    for (const token of tokens) {
      const image = tokenImage(token);
      if (image) {
        return image;
      }
    }

    return null;
  }, [tokensQuery.data?.page?.tokens]);

  const featuredCollection: FeaturedCollection | null = useMemo(() => {
    if (!featuredSeed) {
      return null;
    }

    const metadata = collectionQuery.data?.metadata;

    return {
      address: featuredSeed.address,
      name: metadataName(metadata) ?? featuredSeed.name,
      projectId: featuredSeed.projectId,
      imageUrl: metadataImage(metadata) ?? featuredTokenImage,
      floorPrice: resolvedFloor?.price ?? null,
      totalSupply: formatNumberish(collectionQuery.data?.totalSupply) ?? null,
      listingCount,
    };
  }, [
    collectionQuery.data?.metadata,
    collectionQuery.data?.totalSupply,
    featuredSeed,
    featuredTokenImage,
    listingCount,
    resolvedFloor?.price,
  ]);

  const trendingTokens = useMemo<TrendingToken[]>(() => {
    if (!featuredSeed) {
      return [];
    }

    const tokens = tokensQuery.data?.page?.tokens ?? [];

    return tokens
      .map((token) => {
        const id = displayTokenId(token);
        const listing = cheapestListings.get(id);

        return {
          token,
          href: `/collections/${featuredSeed.address}/${id}`,
          price: listing ? formatPriceForDisplay(listing.price) : null,
          currency: listing?.currency ?? null,
          rawPrice: sortablePrice(listing?.price),
        };
      })
      .sort((left, right) => {
        if (left.rawPrice === null && right.rawPrice === null) {
          return tokenName(left.token).localeCompare(tokenName(right.token));
        }
        if (left.rawPrice === null) {
          return 1;
        }
        if (right.rawPrice === null) {
          return -1;
        }
        if (left.rawPrice === right.rawPrice) {
          return 0;
        }

        return left.rawPrice < right.rawPrice ? -1 : 1;
      })
      .map((entry) => ({
        token: entry.token,
        href: entry.href,
        price: entry.price,
        currency: entry.currency,
      }))
      .slice(0, 12);
  }, [cheapestListings, featuredSeed, tokensQuery.data?.page?.tokens]);

  const sidebarCollections = useMemo<SidebarCollection[]>(() => {
    return collections.map((collection) => ({
      address: collection.address,
      name: collection.name,
      projectId: collection.projectId,
      imageUrl:
        featuredCollection && featuredCollection.address === collection.address
          ? featuredCollection.imageUrl
          : null,
      floorPrice:
        featuredCollection && featuredCollection.address === collection.address
          ? featuredCollection.floorPrice
          : null,
    }));
  }, [collections, featuredCollection]);

  const collectionCards = useMemo<CollectionCardData[]>(() => {
    return collections.map((collection) => ({
      address: collection.address,
      name: collection.name,
      projectId: collection.projectId,
      imageUrl:
        featuredCollection && featuredCollection.address === collection.address
          ? featuredCollection.imageUrl
          : null,
      floorPrice:
        featuredCollection && featuredCollection.address === collection.address
          ? featuredCollection.floorPrice
          : null,
      totalSupply:
        featuredCollection && featuredCollection.address === collection.address
          ? featuredCollection.totalSupply
          : null,
      listingCount:
        featuredCollection && featuredCollection.address === collection.address
          ? featuredCollection.listingCount
          : null,
    }));
  }, [collections, featuredCollection]);

  const isLoading =
    !!featuredSeed
    && (collectionQuery.isLoading || tokensQuery.isLoading || listingsQuery.isLoading);

  return {
    featuredCollection,
    trendingTokens,
    sidebarCollections,
    collectionCards,
    isLoading,
  };
}
