"use client";

import { CollectionCard } from "@/features/home/collection-card";
import type { CollectionCardData } from "@/features/home/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntrance } from "@/lib/animation";

type CollectionCardsSectionProps = {
  collections: CollectionCardData[];
  isLoading?: boolean;
};

export function CollectionCardsSection({
  collections,
  isLoading = false,
}: CollectionCardsSectionProps) {
  const gridRef = useEntrance<HTMLDivElement>({
    selector: "[data-card]",
    staggerDelay: 40,
    translateY: 16,
  });

  return (
    <section data-testid="collection-cards" className="space-y-3">
      <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
        Collections
      </h2>

      {isLoading ? (
        <div
          data-testid="collection-cards-grid"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              data-testid="collection-card-skeleton"
              className="aspect-square w-full"
            />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No collections to show</p>
      ) : (
        <div
          ref={gridRef}
          data-testid="collection-cards-grid"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
        >
          {collections.map((collection) => (
            <div key={collection.address} data-card>
              <CollectionCard {...collection} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
