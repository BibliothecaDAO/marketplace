"use client";

import { useEffect, useMemo, useReducer } from "react";
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

const GRID_CLASSES = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

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

  const nextCursor = tokenQuery.data?.page?.nextCursor ?? null;
  const canLoadMore = Boolean(nextCursor);
  const visibleTokens = pagination.tokens;
  const listingPrices = cheapestListingByTokenId(listingQuery.data);
  const listingPriceMap = listingPriceByTokenId(listingQuery.data);
  const sortedTokens = useMemo(
    () => sortTokens(visibleTokens, sortMode, listingPrices, listingPriceMap),
    [listingPriceMap, listingPrices, sortMode, visibleTokens],
  );

  return (
    <section className="space-y-4">
      {tokenQuery.isLoading && pagination.tokens.length === 0 ? (
        <div className={cn("grid gap-3", GRID_CLASSES)}>
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
          className={cn("grid gap-3", GRID_CLASSES)}
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
