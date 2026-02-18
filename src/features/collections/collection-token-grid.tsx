"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
  tokenId,
  tokenPrice,
} from "@/lib/marketplace/token-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ActiveFilters,
  filterTokensByActiveFilters,
} from "@/lib/marketplace/traits";
import { cn } from "@/lib/utils";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useCartStore } from "@/features/cart/store/cart-store";

type CollectionTokenGridProps = {
  address: string;
  projectId?: string;
  limit?: number;
  tokenIds?: string[];
  activeFilters?: ActiveFilters;
  onTokensChange?: (tokens: NormalizedToken[]) => void;
};

type GridDensity = "compact" | "standard" | "comfort";

const GRID_DENSITY_OPTIONS: Array<{ label: string; value: GridDensity }> = [
  { label: "Compact", value: "compact" },
  { label: "Standard", value: "standard" },
  { label: "Comfort", value: "comfort" },
];

const GRID_DENSITY_CLASSES: Record<GridDensity, string> = {
  compact: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6",
  standard: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  comfort: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
};

function dedupeTokens(tokens: NormalizedToken[]) {
  const unique = new Map<string, NormalizedToken>();

  tokens.forEach((item) => {
    unique.set(tokenId(item), item);
  });

  return Array.from(unique.values());
}

function tokenSignature(tokens: NormalizedToken[]) {
  return tokens.map((item) => tokenId(item)).join(",");
}

export function CollectionTokenGrid({
  address,
  projectId,
  limit = 24,
  tokenIds,
  activeFilters,
  onTokensChange,
}: CollectionTokenGridProps) {
  const addItem = useCartStore((state) => state.addItem);
  const tokenIdsKey = useMemo(() => tokenIds?.join(",") ?? "", [tokenIds]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [tokens, setTokens] = useState<NormalizedToken[]>([]);
  const [gridDensity, setGridDensity] = useState<GridDensity>("standard");

  const tokenQuery = useCollectionTokensQuery({
    address,
    project: projectId,
    limit,
    tokenIds,
    cursor,
    fetchImages: true,
  });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    verifyOwnership: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens([]);
  }, [address, projectId, limit, tokenIdsKey]);

  useEffect(() => {
    if (!tokenQuery.isSuccess) {
      return;
    }

    const pageTokens = tokenQuery.data?.page?.tokens ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens((previous) => {
      const next = !cursor
        ? dedupeTokens(pageTokens)
        : dedupeTokens([...previous, ...pageTokens]);

      return tokenSignature(previous) === tokenSignature(next) ? previous : next;
    });
  }, [cursor, tokenQuery.data, tokenQuery.isSuccess]);

  useEffect(() => {
    onTokensChange?.(tokens);
  }, [tokens, onTokensChange]);

  const nextCursor = tokenQuery.data?.page?.nextCursor ?? null;
  const canLoadMore = Boolean(nextCursor);
  const visibleTokens = useMemo(
    () =>
      activeFilters && Object.keys(activeFilters).length > 0
        ? filterTokensByActiveFilters(tokens, activeFilters)
        : tokens,
    [activeFilters, tokens],
  );
  const listingPrices = cheapestListingByTokenId(listingQuery.data);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-wide uppercase text-muted-foreground">
          Grid density
        </p>
        <div aria-label="Grid density" className="flex items-center gap-1">
          {GRID_DENSITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              onClick={() => setGridDensity(option.value)}
              size="sm"
              type="button"
              variant={gridDensity === option.value ? "default" : "outline"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {tokenQuery.isLoading && tokens.length === 0 ? (
        <div className={cn("grid gap-3", GRID_DENSITY_CLASSES[gridDensity])}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`token-skeleton-${index}`}>
              <CardContent className="space-y-2 p-3">
                <Skeleton className="h-40 w-full" data-testid="token-skeleton" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tokenQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Failed to load tokens.
          </CardContent>
        </Card>
      ) : null}

      {!tokenQuery.isLoading ? (
        <div
          className={cn("grid gap-3", GRID_DENSITY_CLASSES[gridDensity])}
          data-testid="collection-token-grid-cards"
        >
          {visibleTokens.map((token) => (
            <div key={tokenId(token)} className="space-y-2">
              <MarketplaceTokenCard
                cardContentAriaLabel={`token-${displayTokenId(token)}`}
                cardContentRole="article"
                href={`/collections/${address}/${tokenId(token)}`}
                linkAriaLabel={`token-${displayTokenId(token)}`}
                price={listingPrices.get(displayTokenId(token))?.price ?? tokenPrice(token)}
                token={token}
              />
              <Button
                className="w-full"
                disabled={!listingPrices.get(displayTokenId(token))}
                onClick={() => {
                  const listing = listingPrices.get(displayTokenId(token));
                  if (!listing) {
                    return;
                  }

                  addItem(
                    cartItemFromTokenListing(token, address, listing, projectId),
                  );
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Add to cart
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {tokenQuery.isSuccess && visibleTokens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground font-mono">
            <span className="text-primary mr-1">$</span>
            grep --traits -- 0 results
          </CardContent>
        </Card>
      ) : null}

      {canLoadMore ? (
        <Button
          disabled={tokenQuery.isFetching}
          onClick={() => {
            if (nextCursor) {
              setCursor(nextCursor);
            }
          }}
          type="button"
        >
          Load more
        </Button>
      ) : null}
    </section>
  );
}
