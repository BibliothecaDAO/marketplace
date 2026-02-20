"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
  listingPriceByTokenId,
  tokenId,
  tokenPrice,
} from "@/lib/marketplace/token-display";

// Expand token IDs from a listing price map to include both decimal and hex forms,
// which the SDK may need to resolve either variant.
function expandedListingTokenIds(priceMap: Map<string, unknown>): string[] {
  const expanded = new Set<string>();
  for (const id of priceMap.keys()) {
    if (!id) continue;
    expanded.add(id);
    if (/^\d+$/.test(id)) {
      try {
        expanded.add(`0x${BigInt(id).toString(16)}`);
      } catch {
        // skip malformed ids
      }
    }
  }
  return Array.from(expanded);
}
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { cn } from "@/lib/utils";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useAddToCartFeedback } from "@/features/cart/hooks/use-add-to-cart-feedback";
import { type CollectionSortMode } from "@/features/collections/collection-query-params";

type CollectionTokenGridProps = {
  address: string;
  projectId?: string;
  limit?: number;
  tokenIds?: string[];
  activeFilters?: ActiveFilters;
  sortMode?: CollectionSortMode;
  onTokensChange?: (tokens: NormalizedToken[]) => void;
};

type GridDensityMode = "compact" | "standard" | "comfort";

const GRID_CLASSES_BY_DENSITY: Record<GridDensityMode, string> = {
  compact: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  standard: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  comfort: "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2",
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

function sortablePrice(
  token: NormalizedToken,
  listingPrices: Map<string, { price: string }>,
  listingPriceMap: Map<string, string>,
) {
  const tokenKey = displayTokenId(token);
  const rawPrice =
    listingPrices.get(tokenKey)?.price ??
    listingPriceMap.get(tokenKey) ??
    tokenPrice(token);
  if (!rawPrice) {
    return null;
  }

  try {
    return BigInt(rawPrice);
  } catch {
    return null;
  }
}

function sortTokens(
  tokens: NormalizedToken[],
  sortMode: CollectionSortMode,
  listingPrices: Map<string, { price: string }>,
  listingPriceMap: Map<string, string>,
) {
  if (sortMode === "recent") {
    return tokens;
  }

  const ordered = [...tokens];
  ordered.sort((left, right) => {
    const leftPrice = sortablePrice(left, listingPrices, listingPriceMap);
    const rightPrice = sortablePrice(right, listingPrices, listingPriceMap);

    if (leftPrice === null && rightPrice === null) {
      return tokenId(left).localeCompare(tokenId(right));
    }
    if (leftPrice === null) {
      return 1;
    }
    if (rightPrice === null) {
      return -1;
    }
    if (leftPrice === rightPrice) {
      return tokenId(left).localeCompare(tokenId(right));
    }

    const isAscending = sortMode === "price-asc";
    if (leftPrice < rightPrice) {
      return isAscending ? -1 : 1;
    }

    return isAscending ? 1 : -1;
  });

  return ordered;
}

type GridPaginationState = {
  cursor: string | null | undefined;
  tokens: NormalizedToken[];
};

type GridPaginationAction =
  | { type: "RESET" }
  | { type: "APPEND_PAGE"; pageTokens: NormalizedToken[] }
  | { type: "ADVANCE_CURSOR"; cursor: string };

function gridPaginationReducer(
  state: GridPaginationState,
  action: GridPaginationAction,
): GridPaginationState {
  switch (action.type) {
    case "RESET":
      return { cursor: undefined, tokens: [] };
    case "APPEND_PAGE": {
      const next = !state.cursor
        ? dedupeTokens(action.pageTokens)
        : dedupeTokens([...state.tokens, ...action.pageTokens]);
      // Return the SAME reference so React bails out when tokens are unchanged.
      // This prevents an infinite render loop when the query returns a new object
      // reference each render (e.g. in tests) but the underlying data hasn't changed.
      if (tokenSignature(state.tokens) === tokenSignature(next)) return state;
      return { ...state, tokens: next };
    }
    case "ADVANCE_CURSOR":
      return { ...state, cursor: action.cursor };
  }
}

export function CollectionTokenGrid({
  address,
  projectId,
  limit = 24,
  tokenIds,
  activeFilters,
  sortMode = "recent",
  onTokensChange,
}: CollectionTokenGridProps) {
  const { addListingToCart, isRecentlyAdded } = useAddToCartFeedback();
  const [gridDensity, setGridDensity] = useState<GridDensityMode>("standard");
  const tokenIdsKey = useMemo(() => tokenIds?.join(",") ?? "", [tokenIds]);
  const activeFiltersKey = useMemo(
    () =>
      activeFilters
        ? Object.entries(activeFilters)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${Array.from(v).sort().join(",")}`)
            .join("|")
        : "",
    [activeFilters],
  );
  const attributeFilters = useMemo(
    () =>
      activeFilters && Object.keys(activeFilters).length > 0
        ? Object.fromEntries(Object.entries(activeFilters))
        : undefined,
    [activeFilters],
  );
  const [pagination, dispatch] = useReducer(gridPaginationReducer, {
    cursor: undefined,
    tokens: [],
  });

  const tokenQuery = useCollectionTokensQuery({
    address,
    project: projectId,
    limit,
    tokenIds,
    cursor: pagination.cursor,
    fetchImages: true,
    attributeFilters,
  });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    verifyOwnership: false,
  });

  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [address, projectId, limit, tokenIdsKey, activeFiltersKey]);

  useEffect(() => {
    if (!tokenQuery.isSuccess) return;
    const pageTokens = tokenQuery.data?.page?.tokens ?? [];
    dispatch({ type: "APPEND_PAGE", pageTokens });
  }, [tokenQuery.data, tokenQuery.isSuccess]);

  useEffect(() => {
    onTokensChange?.(pagination.tokens);
  }, [pagination.tokens, onTokensChange]);

  const listingPrices = cheapestListingByTokenId(listingQuery.data);
  const listingPriceMap = listingPriceByTokenId(listingQuery.data);

  // When sorting by price, explicitly fetch the listed token IDs so they are
  // present in the grid regardless of which page of the general query they fall on.
  const listedQueryTokenIds = useMemo(
    () => (sortMode !== "recent" ? expandedListingTokenIds(listingPriceMap) : []),
    [listingPriceMap, sortMode],
  );
  const listedTokensQuery = useCollectionTokensQuery(
    {
      address,
      project: projectId,
      tokenIds: listedQueryTokenIds.length > 0 ? listedQueryTokenIds : undefined,
      limit: Math.max(listedQueryTokenIds.length, 1),
      fetchImages: true,
      attributeFilters,
    },
    { enabled: sortMode !== "recent" && listedQueryTokenIds.length > 0 },
  );

  const nextCursor = tokenQuery.data?.page?.nextCursor ?? null;
  const canLoadMore = Boolean(nextCursor);

  // Merge explicitly-fetched listed tokens with the paginated set so that
  // price sorting always has them available even if they are not on page 1.
  const visibleTokens = useMemo(() => {
    const listedTokens = listedTokensQuery.data?.page?.tokens;
    if (!listedTokens?.length) return pagination.tokens;
    return dedupeTokens([...listedTokens, ...pagination.tokens]);
  }, [pagination.tokens, listedTokensQuery.data?.page?.tokens]);

  const sortedTokens = useMemo(
    () => sortTokens(visibleTokens, sortMode, listingPrices, listingPriceMap),
    [listingPriceMap, listingPrices, sortMode, visibleTokens],
  );
  const gridClasses = GRID_CLASSES_BY_DENSITY[gridDensity];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <Button
          aria-pressed={gridDensity === "compact"}
          onClick={() => setGridDensity("compact")}
          size="sm"
          type="button"
          variant={gridDensity === "compact" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Compact
        </Button>
        <Button
          aria-pressed={gridDensity === "standard"}
          onClick={() => setGridDensity("standard")}
          size="sm"
          type="button"
          variant={gridDensity === "standard" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Standard
        </Button>
        <Button
          aria-pressed={gridDensity === "comfort"}
          onClick={() => setGridDensity("comfort")}
          size="sm"
          type="button"
          variant={gridDensity === "comfort" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Comfort
        </Button>
      </div>

      {tokenQuery.isLoading && pagination.tokens.length === 0 ? (
        <div className={cn("grid gap-3", gridClasses)}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
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
          className={cn("grid gap-3", gridClasses)}
          data-testid="collection-token-grid-cards"
        >
          {sortedTokens.map((token) => {
            const tokenKey = displayTokenId(token);
            const cheapestListing = listingPrices.get(tokenKey);
            const isAdded = isRecentlyAdded(cheapestListing?.orderId);
            const price =
              cheapestListing?.price ??
              listingPriceMap.get(tokenKey) ??
              tokenPrice(token);

            return (
              <div key={tokenId(token)} className="space-y-2">
                <MarketplaceTokenCard
                  cardContentAriaLabel={`token-${tokenKey}`}
                  cardContentRole="article"
                  currency={cheapestListing?.currency ?? null}
                  href={`/collections/${address}/${tokenId(token)}`}
                  linkAriaLabel={`token-${tokenKey}`}
                  price={price}
                  token={token}
                />
                <Button
                  className="w-full"
                  disabled={!cheapestListing}
                  onClick={() => {
                    if (!cheapestListing) {
                      return;
                    }

                    addListingToCart(
                      cartItemFromTokenListing(
                        token,
                        address,
                        cheapestListing,
                        projectId,
                      ),
                    );
                  }}
                  size="sm"
                  type="button"
                  variant={isAdded ? "default" : "outline"}
                >
                  {isAdded ? "Added" : "Add to cart"}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      {tokenQuery.isSuccess && visibleTokens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No tokens match your filters. Try removing some filters.
          </CardContent>
        </Card>
      ) : null}

      {canLoadMore ? (
        <Button
          disabled={tokenQuery.isFetching}
          onClick={() => {
            if (nextCursor) {
              dispatch({ type: "ADVANCE_CURSOR", cursor: nextCursor });
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
