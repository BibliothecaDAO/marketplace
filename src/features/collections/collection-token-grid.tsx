"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/collection-hooks";
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
import { ResourceTraitIcons } from "@/components/marketplace/resource-trait-icons";
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
import { getCollectionFilterConfig } from "@/lib/marketplace/collection-filter-config";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { numericTraitValueByName } from "@/lib/marketplace/traits";
import { COLLECTION_LISTING_SAMPLE_LIMIT } from "@/lib/marketplace/query-limits";
import { expandTokenIdQueryVariants } from "@/lib/marketplace/token-id";
import { realmResourceCount, realmResources } from "@/lib/marketplace/token-attributes";
import { cn } from "@/lib/utils";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useAddToCartFeedback } from "@/features/cart/hooks/use-add-to-cart-feedback";
import { type CollectionSortMode } from "@/features/collections/collection-query-params";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

type CollectionTokenGridProps = {
  address: string;
  projectId?: string;
  limit?: number;
  tokenIds?: string[];
  activeFilters?: ActiveFilters;
  sortMode?: CollectionSortMode;
  onTokensChange?: (tokens: NormalizedToken[]) => void;
  sortControls?: ReactNode;
  sweepPreviewTokenIds?: Set<string>;
};

type GridDensityMode = "compact" | "dense";
type GridLayoutMode = GridDensityMode | "list";

const GRID_CLASSES_BY_DENSITY: Record<GridDensityMode, string> = {
  compact: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  dense: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
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

function normalizeAddress(address: string) {
  try {
    return `0x${BigInt(address).toString(16)}`;
  } catch {
    return address.toLowerCase();
  }
}

function numericAttribute(token: NormalizedToken, traitName: string) {
  const metadata = token.metadata as { attributes?: unknown } | null;
  if (!Array.isArray(metadata?.attributes)) {
    return null;
  }

  for (const rawAttribute of metadata.attributes) {
    if (!rawAttribute || typeof rawAttribute !== "object") {
      continue;
    }

    const attribute = rawAttribute as Record<string, unknown>;
    const resolvedTraitName = String(
      attribute.trait_type ?? attribute.traitName ?? attribute.name ?? "",
    ).trim();
    if (resolvedTraitName !== traitName) {
      continue;
    }

    const numericValue = Number(attribute.value ?? attribute.traitValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
}

function stringAttribute(token: NormalizedToken, traitNames: string[]) {
  const metadata = token.metadata as { attributes?: unknown } | null;
  if (!Array.isArray(metadata?.attributes)) {
    return null;
  }

  const accepted = new Set(traitNames);
  for (const rawAttribute of metadata.attributes) {
    if (!rawAttribute || typeof rawAttribute !== "object") {
      continue;
    }

    const attribute = rawAttribute as Record<string, unknown>;
    const resolvedTraitName = String(
      attribute.trait_type ?? attribute.traitName ?? attribute.name ?? "",
    ).trim();
    if (!accepted.has(resolvedTraitName)) {
      continue;
    }

    const value = String(attribute.value ?? attribute.traitValue ?? "").trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function isAliveAdventurer(token: NormalizedToken) {
  const health = numericAttribute(token, "Health");
  if (health !== null && health <= 0) {
    return false;
  }

  const expiredValue = stringAttribute(token, ["Expired", "Status", "Alive", "Dead"]);
  if (!expiredValue) {
    return true;
  }

  const normalized = expiredValue.toLowerCase();
  if (normalized === "expired" || normalized === "dead" || normalized === "false" || normalized === "0") {
    return false;
  }

  return true;
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

  const traitNameBySortMode: Partial<Record<CollectionSortMode, string>> = {
    "power-asc": "Power",
    "power-desc": "Power",
    "level-asc": "Level",
    "level-desc": "Level",
    "health-asc": "Health",
    "health-desc": "Health",
    "resource-count-asc": "Resource count",
    "resource-count-desc": "Resource count",
  };
  const ordered = [...tokens];
  ordered.sort((left, right) => {
    if (sortMode === "resource-count-asc" || sortMode === "resource-count-desc") {
      const leftValue = realmResourceCount(left.metadata);
      const rightValue = realmResourceCount(right.metadata);
      if (leftValue === rightValue) {
        return tokenId(left).localeCompare(tokenId(right));
      }

      const isAscending = sortMode === "resource-count-asc";
      if (leftValue < rightValue) {
        return isAscending ? -1 : 1;
      }

      return isAscending ? 1 : -1;
    }

    const traitName = traitNameBySortMode[sortMode];
    if (traitName) {
      const leftValue = numericTraitValueByName(left.metadata, traitName);
      const rightValue = numericTraitValueByName(right.metadata, traitName);

      if (leftValue === null && rightValue === null) {
        return tokenId(left).localeCompare(tokenId(right));
      }
      if (leftValue === null) {
        return 1;
      }
      if (rightValue === null) {
        return -1;
      }
      if (leftValue === rightValue) {
        return tokenId(left).localeCompare(tokenId(right));
      }

      const isAscending = sortMode.endsWith("-asc");
      if (leftValue < rightValue) {
        return isAscending ? -1 : 1;
      }

      return isAscending ? 1 : -1;
    }

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
  sortControls,
  sweepPreviewTokenIds,
}: CollectionTokenGridProps) {
  const { addListingToCart, isRecentlyAdded } = useAddToCartFeedback();
  const collectionFilterConfig = useMemo(
    () => getCollectionFilterConfig(address),
    [address],
  );
  const showInlineResources = collectionFilterConfig.showInlineResources === true;
  const [gridMode, setGridMode] = useState<GridLayoutMode>("compact");
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
        ? Object.fromEntries(
            Object.entries(activeFilters).map(([k, v]) => [k, Array.from(v)]),
          )
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

  const onTokensChangeRef = useRef(onTokensChange);
  const emittedVisibleTokensSignatureRef = useRef("");
  useEffect(() => {
    onTokensChangeRef.current = onTokensChange;
  });

  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [address, projectId, limit, tokenIdsKey, activeFiltersKey]);

  useEffect(() => {
    if (!tokenQuery.isSuccess) return;
    const pageTokens = tokenQuery.data?.page?.tokens ?? [];
    dispatch({ type: "APPEND_PAGE", pageTokens });
  }, [tokenQuery.data, tokenQuery.isSuccess]);

  const listingPrices = cheapestListingByTokenId(listingQuery.data);
  const listingPriceMap = listingPriceByTokenId(listingQuery.data);
  const isAdventurersCollection = useMemo(
    () =>
      getMarketplaceRuntimeConfig().collections.some(
        (collection) =>
          normalizeAddress(collection.address) === normalizeAddress(address)
          && collection.name.trim().toLowerCase() === "adventurers",
      ),
    [address],
  );

  // Always resolve listed token IDs so listed inventory remains visible even
  // when the paginated token query does not include those tokens on page 1.
  const listedQueryTokenIds = useMemo(
    () => expandTokenIdQueryVariants(listingPriceMap.keys()),
    [listingPriceMap],
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
    { enabled: listedQueryTokenIds.length > 0 },
  );

  const nextCursor = tokenQuery.data?.page?.nextCursor ?? null;
  const canLoadMore = Boolean(nextCursor);

  // Append explicitly-fetched listed tokens after the current page to preserve
  // recent ordering while still surfacing listed inventory that lives off-page.
  const visibleTokens = useMemo(() => {
    const listedTokens = listedTokensQuery.data?.page?.tokens;
    if (!listedTokens?.length) return pagination.tokens;
    return dedupeTokens([...pagination.tokens, ...listedTokens]);
  }, [pagination.tokens, listedTokensQuery.data?.page?.tokens]);
  const displayTokens = useMemo(
    () =>
      isAdventurersCollection
        ? visibleTokens.filter(isAliveAdventurer)
        : visibleTokens,
    [isAdventurersCollection, visibleTokens],
  );
  const visibleTokensSignature = useMemo(
    () => tokenSignature(displayTokens),
    [displayTokens],
  );

  useEffect(() => {
    if (emittedVisibleTokensSignatureRef.current === visibleTokensSignature) {
      return;
    }

    emittedVisibleTokensSignatureRef.current = visibleTokensSignature;
    onTokensChangeRef.current?.(displayTokens);
  }, [displayTokens, visibleTokensSignature]);

  const sortedTokens = useMemo(
    () => sortTokens(displayTokens, sortMode, listingPrices, listingPriceMap),
    [displayTokens, listingPriceMap, listingPrices, sortMode],
  );
  const isListMode = gridMode === "list";
  const gridClasses = GRID_CLASSES_BY_DENSITY[isListMode ? "compact" : gridMode];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>{sortControls}</div>
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
            const cardItem = cheapestListing
              ? cartItemFromTokenListing(
                token,
                address,
                cheapestListing,
                projectId,
              )
              : null;

            return (
              <div key={tokenId(token)}>
                <div
                  className={cn(
                    "rounded-lg transition-all duration-150",
                    isSweepPreview && "relative z-10 ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <MarketplaceTokenCard
                    buyNowLabel={isAdded ? "Added" : "Buy Now"}
                    cardContentAriaLabel={`token-${tokenKey}`}
                    cardContentRole="article"
                    currency={cheapestListing?.currency ?? null}
                    href={`/collections/${address}/${tokenId(token)}`}
                    inlineTraits={
                      showInlineResources ? (
                        <ResourceTraitIcons resources={realmResources(token.metadata)} />
                      ) : undefined
                    }
                    linkAriaLabel={`token-${tokenKey}`}
                    onBuyNow={
                      cardItem && !isSweepPreview
                        ? () => {
                          addListingToCart(cardItem);
                        }
                        : undefined
                    }
                    onSelect={
                      cardItem && !isSweepPreview
                        ? () => {
                          addListingToCart(cardItem, { openCart: false });
                        }
                        : undefined
                    }
                    price={price}
                    showActions
                    token={token}
                  />
                </div>
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
                          {showInlineResources ? (
                            <ResourceTraitIcons
                              resources={realmResources(token.metadata)}
                              showLabels
                            />
                          ) : null}
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

      {tokenQuery.isSuccess && displayTokens.length === 0 ? (
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
