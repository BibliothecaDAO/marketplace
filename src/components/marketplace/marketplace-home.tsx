"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CollectionCardsSection } from "@/features/home/collection-cards-section";
import { HeroBanner } from "@/features/home/hero-banner";
import { TrendingTokensSection } from "@/features/home/trending-tokens-section";
import { useHomePageData } from "@/features/home/use-home-page-data";
import { matchesHomeSearch, normalizeHomeSearchQuery } from "@/lib/marketplace/home-search";
import { Search as SearchIcon } from "lucide-react";
import { displayTokenId, tokenName } from "@/lib/marketplace/token-display";

export function MarketplaceHome() {
  const searchParams = useSearchParams();
  const query = normalizeHomeSearchQuery(searchParams.get("q") ?? "");
  const {
    featuredCollection,
    trendingTokens,
    collectionCards,
    isLoading,
  } = useHomePageData();

  const filteredTrendingTokens = useMemo(
    () =>
      trendingTokens.filter((entry) =>
        matchesHomeSearch(query, [
          tokenName(entry.token),
          displayTokenId(entry.token),
          entry.href,
        ]),
      ),
    [query, trendingTokens],
  );

  const filteredCollectionCards = useMemo(
    () =>
      collectionCards.filter((collection) =>
        matchesHomeSearch(query, [collection.name, collection.address]),
      ),
    [collectionCards, query],
  );

  if (!isLoading && collectionCards.length === 0) {
    return (
      <main data-testid="marketplace-home" className="flex-1 px-4 pt-6 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground font-mono">
          <span className="mr-1 text-primary">$</span>
          No collections configured
        </p>
      </main>
    );
  }

  if (
    !isLoading
    && query
    && filteredTrendingTokens.length === 0
    && filteredCollectionCards.length === 0
  ) {
    return (
      <main data-testid="marketplace-home" className="flex-1 px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <SearchIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            No results for &quot;{query}&quot;
          </p>
          <p className="text-xs text-muted-foreground">
            Try searching for a collection name or token ID
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="marketplace-home"
      className="flex-1 space-y-8 px-4 pt-6 sm:px-6 lg:px-8"
    >
      <HeroBanner
        name={featuredCollection?.name ?? "Featured Collection"}
        address={featuredCollection?.address ?? ""}
        imageUrl={featuredCollection?.imageUrl}
        floorPrice={featuredCollection?.floorPrice}
        totalSupply={featuredCollection?.totalSupply}
        listingCount={featuredCollection?.listingCount}
        isLoading={isLoading}
      />
      <TrendingTokensSection
        tokens={filteredTrendingTokens}
        isLoading={isLoading}
      />
      <CollectionCardsSection
        collections={filteredCollectionCards}
        isLoading={isLoading}
      />
    </main>
  );
}
