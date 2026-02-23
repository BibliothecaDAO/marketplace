"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/hooks";
import {
  formatPriceForDisplay,
  displayTokenId,
  listingPriceByTokenId,
  tokenId,
  tokenName,
  tokenPrice,
} from "@/lib/marketplace/token-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenSymbol } from "@/components/ui/token-symbol";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { COLLECTION_LISTING_SAMPLE_LIMIT } from "@/lib/marketplace/query-limits";
import { expandTokenIdVariants } from "@/lib/marketplace/token-id";
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
  sweepPreviewTokenIds?: Set<string>;
};

type GridDensityMode = "compact" | "dense" | "standard" | "comfort";
type GridLayoutMode = GridDensityMode | "list";

const GRID_CLASSES_BY_DENSITY: Record<GridDensityMode, string> = {
  compact: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  dense: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
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
  sweepPreviewTokenIds,
}: CollectionTokenGridProps) {
  const { addListingToCart, isRecentlyAdded } = useAddToCartFeedback();
  const [gridMode, setGridMode] = useState<GridLayoutMode>("standard");
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
    limit: COLLECTION_LISTING_SAMPLE_LIMIT,
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
    () =>
      (sortMode !== "recent"
        ? expandTokenIdVariants(listingPriceMap.keys())
        : []),
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
  const isListMode = gridMode === "list";
  const gridClasses = GRID_CLASSES_BY_DENSITY[isListMode ? "standard" : gridMode];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <Button
          aria-pressed={gridMode === "compact"}
          onClick={() => setGridMode("compact")}
          size="sm"
          type="button"
          variant={gridMode === "compact" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Compact
        </Button>
        <Button
          aria-pressed={gridMode === "dense"}
          onClick={() => setGridMode("dense")}
          size="sm"
          type="button"
          variant={gridMode === "dense" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Dense
        </Button>
        <Button
          aria-pressed={gridMode === "standard"}
          onClick={() => setGridMode("standard")}
          size="sm"
          type="button"
          variant={gridMode === "standard" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Standard
        </Button>
        <Button
          aria-pressed={gridMode === "comfort"}
          onClick={() => setGridMode("comfort")}
          size="sm"
          type="button"
          variant={gridMode === "comfort" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          Comfort
        </Button>
        <Button
          aria-pressed={gridMode === "list"}
          onClick={() => setGridMode("list")}
          size="sm"
          type="button"
          variant={gridMode === "list" ? "default" : "outline"}
          className="h-7 px-2 text-xs"
        >
          List
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

      {!tokenQuery.isLoading && !isListMode ? (
        <div
          className={cn("grid gap-3", gridClasses)}
          data-testid="collection-token-grid-cards"
        >
          {sortedTokens.map((token) => {
            const tokenKey = displayTokenId(token);
            const cheapestListing = listingPrices.get(tokenKey);
            const isAdded = isRecentlyAdded(cheapestListing?.orderId);
            const isSweepPreview = sweepPreviewTokenIds?.has(tokenKey) ?? false;
            const price =
              cheapestListing?.price ??
              listingPriceMap.get(tokenKey) ??
              tokenPrice(token);

            return (
              <div key={tokenId(token)} className="space-y-2">
                <div
                  className={cn(
                    "rounded-lg transition-all duration-150",
                    isSweepPreview && "relative z-10 ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <MarketplaceTokenCard
                    cardContentAriaLabel={`token-${tokenKey}`}
                    cardContentRole="article"
                    currency={cheapestListing?.currency ?? null}
                    href={`/collections/${address}/${tokenId(token)}`}
                    linkAriaLabel={`token-${tokenKey}`}
                    price={price}
                    token={token}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!cheapestListing || isSweepPreview}
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
                  variant={isAdded ? "default" : isSweepPreview ? "secondary" : "outline"}
                >
                  {isAdded ? "Added" : isSweepPreview ? "Pending sweep" : "Add to cart"}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      {!tokenQuery.isLoading && isListMode ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table data-testid="collection-token-grid-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTokens.map((token) => {
                  const tokenKey = displayTokenId(token);
                  const cheapestListing = listingPrices.get(tokenKey);
                  const isAdded = isRecentlyAdded(cheapestListing?.orderId);
                  const isSweepPreview = sweepPreviewTokenIds?.has(tokenKey) ?? false;
                  const price =
                    cheapestListing?.price ??
                    listingPriceMap.get(tokenKey) ??
                    tokenPrice(token);
                  const displayPrice = formatPriceForDisplay(price);

                  return (
                    <TableRow key={tokenId(token)} className={cn(isSweepPreview && "bg-muted/60")}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            href={`/collections/${address}/${tokenId(token)}`}
                            className="text-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {tokenName(token)}
                          </Link>
                          <p className="text-xs text-muted-foreground">#{tokenKey}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {displayPrice ? (
                          <p className="text-xs text-primary font-medium flex items-center gap-1">
                            {displayPrice}
                            {cheapestListing?.currency ? (
                              <TokenSymbol
                                address={cheapestListing.currency}
                                className="text-muted-foreground"
                              />
                            ) : null}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not listed</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          disabled={!cheapestListing || isSweepPreview}
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
                          variant={isAdded ? "default" : isSweepPreview ? "secondary" : "outline"}
                          className="w-full sm:w-auto"
                        >
                          {isAdded ? "Added" : isSweepPreview ? "Pending sweep" : "Add to cart"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
