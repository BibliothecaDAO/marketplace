"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HeroBanner } from "@/features/home/hero-banner";
import { CollectionListItem } from "@/features/home/collection-list-item";
import { PromotedCollection } from "@/features/home/promoted-collection";
import { useHomePageData } from "@/features/home/use-home-page-data";
import { matchesHomeSearch, normalizeHomeSearchQuery } from "@/lib/marketplace/home-search";
import { Search as SearchIcon } from "lucide-react";
import { useEntrance } from "@/lib/animation";

export function MarketplaceHome() {
  const searchParams = useSearchParams();
  const query = normalizeHomeSearchQuery(searchParams.get("q") ?? "");
  const {
    featuredCollection,
    collectionCards,
    isLoading,
  } = useHomePageData();

  const filteredCollections = useMemo(
    () =>
      collectionCards.filter((collection) =>
        matchesHomeSearch(query, [collection.name, collection.address]),
      ),
    [collectionCards, query],
  );

  // Pick a promoted collection — use a different one than the hero featured
  // If we have more than 1 collection, pick the second one; otherwise use the first
  const promotedCollection = useMemo(() => {
    if (collectionCards.length === 0) return null;
    // Find the first collection that isn't the hero featured
    const nonFeatured = collectionCards.find(
      (c) => c.address !== featuredCollection?.address
    );
    // Fall back to the featured collection if there's only one
    return nonFeatured
      ? { ...nonFeatured, address: nonFeatured.address, name: nonFeatured.name }
      : featuredCollection;
  }, [collectionCards, featuredCollection]);

  const listRef = useEntrance<HTMLDivElement>({
    selector: "[data-collection-row]",
    staggerDelay: 50,
    translateY: 10,
  });

  if (!isLoading && collectionCards.length === 0) {
    return (
      <main data-testid="marketplace-home" className="flex-1 p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-muted-foreground font-mono">
          <span className="mr-1 text-primary">$</span>
          No collections configured
        </p>
      </main>
    );
  }

  if (!isLoading && query && filteredCollections.length === 0) {
    return (
      <main data-testid="marketplace-home" className="flex-1 p-4 sm:p-6 lg:p-8">
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
    <main data-testid="marketplace-home" className="flex-1 p-4 sm:p-6 lg:p-8">
      {/* Hero */}
      <HeroBanner
        name={featuredCollection?.name ?? "Featured Collection"}
        address={featuredCollection?.address ?? ""}
        imageUrl={featuredCollection?.imageUrl}
        floorPrice={featuredCollection?.floorPrice}
        totalSupply={featuredCollection?.totalSupply}
        listingCount={featuredCollection?.listingCount}
        isLoading={isLoading}
      />

      {/* Two-column layout: Collection list + Promoted collection */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column — Collection list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            Collections
          </h2>
          <div ref={listRef} className="space-y-2">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-3"
                  >
                    <div className="h-14 w-14 shrink-0 rounded-md bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-48 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))
              : filteredCollections.map((collection) => (
                  <div key={collection.address} data-collection-row>
                    <CollectionListItem
                      address={collection.address}
                      name={collection.name}
                      projectId={collection.projectId}
                    />
                  </div>
                ))}
          </div>
        </div>

        {/* Right column — Promoted collection */}
        {promotedCollection && !isLoading ? (
          <div className="hidden lg:block">
            <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-3">
              Featured
            </h2>
            <PromotedCollection
              address={promotedCollection.address}
              name={promotedCollection.name}
              projectId={promotedCollection.projectId}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
