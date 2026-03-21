"use client";

import Link from "next/link";
import type { CollectionCardData } from "@/features/home/types";

type CollectionListItemProps = CollectionCardData;

export function CollectionListItem({
  address,
  name,
  imageUrl,
  floorPrice,
  totalSupply,
  listingCount,
}: CollectionListItemProps) {
  return (
    <Link
      href={`/collections/${address}`}
      className="group flex items-center gap-4 rounded-lg border border-border/60 bg-card p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_12px_oklch(0.75_0.1_75/0.1)]"
    >
      {/* Collection image */}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${name} preview`}
            src={imageUrl}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/60 to-accent/50">
            <span className="text-[10px] text-muted-foreground">&mdash;</span>
          </div>
        )}
      </div>

      {/* Collection info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
          {name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {floorPrice ? (
            <span>
              Floor <span className="font-medium text-primary">{floorPrice}</span>
            </span>
          ) : null}
          {totalSupply ? (
            <span>
              Items <span className="font-medium text-foreground">{totalSupply}</span>
            </span>
          ) : null}
          {listingCount ? (
            <span>
              Listed <span className="font-medium text-foreground">{listingCount}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Chevron */}
      <svg
        className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}
