"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { animate } from "animejs";
import { Button } from "@/components/ui/button";
import type { FeaturedCollection } from "@/features/home/types";

type PromotedCollectionProps = {
  collection: FeaturedCollection;
};

export function PromotedCollection({ collection }: PromotedCollectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animate(el, { opacity: [0, 1], translateY: [12, 0], duration: 500, ease: "easeOutCubic" });
  }, []);

  return (
    <div
      ref={containerRef}
      className="sticky top-20 overflow-hidden rounded-lg border border-primary/20"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-muted">
        {collection.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${collection.name} promoted`}
            src={collection.imageUrl}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/35 via-accent to-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* Promoted badge */}
        <div className="absolute top-3 left-3">
          <span className="rounded-full border border-primary/40 bg-background/80 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-primary">
            Featured
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{collection.name}</h3>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          {collection.floorPrice ? (
            <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground mr-1">Floor</span>
              <span className="font-medium text-primary">{collection.floorPrice}</span>
            </div>
          ) : null}
          {collection.totalSupply ? (
            <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground mr-1">Supply</span>
              <span className="font-medium">{collection.totalSupply}</span>
            </div>
          ) : null}
          {collection.listingCount ? (
            <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground mr-1">Listed</span>
              <span className="font-medium">{collection.listingCount}</span>
            </div>
          ) : null}
        </div>

        <Button asChild className="w-full">
          <Link href={`/collections/${collection.address}`}>
            Explore Collection
          </Link>
        </Button>
      </div>
    </div>
  );
}
