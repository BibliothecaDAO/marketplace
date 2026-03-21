"use client";

import { useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { animate } from "animejs";
import { Button } from "@/components/ui/button";
import {
  useCollectionQuery,
  useCollectionListingsQuery,
} from "@/lib/marketplace/hooks";
import {
  formatPriceForDisplay,
  formatNumberish,
} from "@/lib/marketplace/token-display";
import { getCollectionBannerImage } from "@/lib/marketplace/collection-banners";
import { cheapestListingByTokenId } from "@/features/cart/listing-utils";
import { COLLECTION_LISTING_SAMPLE_LIMIT } from "@/lib/marketplace/query-limits";

type PromotedCollectionProps = {
  address: string;
  name: string;
  projectId?: string;
};

function metadataImage(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const fields = metadata as Record<string, unknown>;
  const image = fields.image ?? fields.image_url;
  return typeof image === "string" && image.trim() ? image : null;
}

export function PromotedCollection({
  address,
  name,
  projectId,
}: PromotedCollectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const collectionQuery = useCollectionQuery({
    address,
    projectId,
    fetchImages: true,
  });

  const listingsQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    limit: COLLECTION_LISTING_SAMPLE_LIMIT,
    verifyOwnership: false,
  });

  const cheapestListings = useMemo(
    () => cheapestListingByTokenId(listingsQuery.data),
    [listingsQuery.data],
  );

  const floorPrice = useMemo(() => {
    let minPrice: bigint | null = null;
    for (const listing of cheapestListings.values()) {
      try {
        const parsed = BigInt(listing.price);
        if (minPrice === null || parsed < minPrice) {
          minPrice = parsed;
        }
      } catch {
        // skip
      }
    }
    if (minPrice === null) return null;
    return formatPriceForDisplay(minPrice.toString());
  }, [cheapestListings]);

  const totalSupply = formatNumberish(collectionQuery.data?.totalSupply) ?? null;
  const listingCount = Array.isArray(listingsQuery.data)
    ? String(listingsQuery.data.length)
    : null;

  const imageUrl =
    metadataImage(collectionQuery.data?.metadata) ??
    getCollectionBannerImage(name);

  const isLoading = collectionQuery.isLoading || listingsQuery.isLoading;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    animate(el, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 500,
      ease: "easeOutCubic",
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="sticky top-20 overflow-hidden rounded-lg border border-primary/20"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${name} promoted`}
            src={imageUrl}
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
          <h3 className="text-lg font-bold tracking-tight">{name}</h3>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          {isLoading ? (
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          ) : (
            <>
              {floorPrice ? (
                <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground mr-1">Floor</span>
                  <span className="font-medium text-primary">{floorPrice}</span>
                </div>
              ) : null}
              {totalSupply ? (
                <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground mr-1">Supply</span>
                  <span className="font-medium">{totalSupply}</span>
                </div>
              ) : null}
              {listingCount ? (
                <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground mr-1">Listed</span>
                  <span className="font-medium">{listingCount}</span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <Button asChild className="w-full">
          <Link href={`/collections/${address}`}>Explore Collection</Link>
        </Button>
      </div>
    </div>
  );
}
