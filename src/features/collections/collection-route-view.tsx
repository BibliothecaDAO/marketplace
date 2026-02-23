"use client";

import { useMemo, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useCollectionQuery,
  useCollectionTraitMetadataQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
  formatPriceForDisplay,
} from "@/lib/marketplace/token-display";
import { TokenSymbol } from "@/components/ui/token-symbol";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type SeedCollection,
  getMarketplaceRuntimeConfig,
} from "@/lib/marketplace/config";
import type { ActiveFilters } from "@/lib/marketplace/traits";
import { CollectionMarketPanel } from "@/features/collections/collection-market-panel";
import { CollectionTokenGrid } from "@/features/collections/collection-token-grid";
import { TraitFilterSidebar } from "@/features/collections/trait-filter-sidebar";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { CART_MAX_ITEMS, useCartStore } from "@/features/cart/store/cart-store";
import { type CollectionSortMode } from "@/features/collections/collection-query-params";
import { SweepBar } from "@/features/collections/sweep-bar";
import { COLLECTION_LISTING_SAMPLE_LIMIT } from "@/lib/marketplace/query-limits";

const EMPTY_ACTIVE_FILTERS: ActiveFilters = {};
const EMPTY_VISIBLE_TOKENS: NormalizedToken[] = [];

type CollectionRouteViewProps = {
  address: string;
  cursor?: string | null;
  collections?: SeedCollection[];
  activeFilters?: ActiveFilters;
  sortMode?: CollectionSortMode;
  onActiveFiltersChange?: (filters: ActiveFilters) => void;
  onSortModeChange?: (sortMode: CollectionSortMode) => void;
  onNavigate?: (href: string) => void;
};

const SORT_OPTIONS: Array<{ label: string; value: CollectionSortMode }> = [
  { label: "Recent", value: "recent" },
  { label: "Price Low to High", value: "price-asc" },
  { label: "Price High to Low", value: "price-desc" },
];

function collectionName(metadata: unknown, fallbackAddress: string) {
  if (metadata && typeof metadata === "object") {
    const name = (metadata as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }

  return fallbackAddress;
}

function floorFromListings(
  cheapestListings: Map<string, { price: string; currency: string }>,
): { price: string; currency: string } | null {
  let min: bigint | null = null;
  let currency = "";

  for (const listing of cheapestListings.values()) {
    try {
      const val = BigInt(listing.price);
      if (min === null || val < min) {
        min = val;
        currency = listing.currency;
      }
    } catch {
      // skip
    }
  }

  if (min === null) {
    return null;
  }

  const price = formatPriceForDisplay(min.toString());
  return price ? { price, currency } : null;
}

function compareBigIntStrings(left: string, right: string) {
  try {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue < rightValue ? -1 : 1;
  } catch {
    return left.localeCompare(right);
  }
}

export function CollectionRouteView({
  address,
  collections,
  activeFilters,
  sortMode = "recent",
  onActiveFiltersChange,
  onSortModeChange,
  onNavigate,
}: CollectionRouteViewProps) {
  const cartItems = useCartStore((state) => state.items);
  const addCandidates = useCartStore((state) => state.addCandidates);
  const setCartOpen = useCartStore((state) => state.setOpen);
  const runtimeCollections = useMemo(
    () => collections ?? getMarketplaceRuntimeConfig().collections,
    [collections],
  );
  const resolvedActiveFilters = activeFilters ?? EMPTY_ACTIVE_FILTERS;
  const selectedCollection = useMemo(
    () =>
      runtimeCollections.find(
        (collectionEntry) => collectionEntry.address === address,
      ),
    [address, runtimeCollections],
  );
  const projectId = selectedCollection?.projectId;
  const sweepScopeKey = `${address}-${projectId ?? "default"}`;
  const [sweepCount, setSweepCount] = useState(0);
  const [visibleTokensByScope, setVisibleTokensByScope] = useState<
    Record<string, NormalizedToken[]>
  >({});
  const collection = useCollectionQuery({ address, projectId, fetchImages: true });
  const traitMetadataQuery = useCollectionTraitMetadataQuery({ address, projectId });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    limit: COLLECTION_LISTING_SAMPLE_LIMIT,
    verifyOwnership: false,
  });

  const cheapestListings = cheapestListingByTokenId(listingQuery.data);
  const listingCount = Array.isArray(listingQuery.data) ? listingQuery.data.length : 0;
  const listingCountLabel =
    listingCount >= COLLECTION_LISTING_SAMPLE_LIMIT
      ? `${COLLECTION_LISTING_SAMPLE_LIMIT}+`
      : String(listingCount);
  const floor = floorFromListings(cheapestListings);
  const totalSupply = collection.data?.totalSupply;
  const displayName = collection.isSuccess && collection.data
    ? collectionName(collection.data.metadata, address)
    : null;

  const visibleTokens = visibleTokensByScope[sweepScopeKey] ?? EMPTY_VISIBLE_TOKENS;

  const sweepCandidates = useMemo(() => {
    if (!visibleTokens.length) return [];

    const cartOrderIds = new Set(cartItems.map((item) => item.orderId));
    const tokenByDisplayId = new Map(
      visibleTokens.map((token) => [displayTokenId(token), token] as const),
    );

    const candidates = Array.from(cheapestListings.values())
      .filter((listing) => !cartOrderIds.has(listing.orderId))
      .map((listing) => {
        const token = tokenByDisplayId.get(listing.tokenId);
        if (!token) return null;
        return cartItemFromTokenListing(token, address, listing, projectId);
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => compareBigIntStrings(left.price, right.price));

    return candidates.slice(0, CART_MAX_ITEMS);
  }, [address, cartItems, cheapestListings, projectId, visibleTokens]);

  // Build the preview set directly from cheapestListings (same key format
  // the grid uses for lookup) so highlighting doesn't depend on listedTokensQuery.
  const cheapestByPrice = useMemo(() => {
    const cartOrderIds = new Set(cartItems.map((item) => item.orderId));
    return Array.from(cheapestListings.entries())
      .filter(([, listing]) => !cartOrderIds.has(listing.orderId))
      .sort(([, a], [, b]) => compareBigIntStrings(a.price, b.price));
  }, [cartItems, cheapestListings]);

  const sweepMaxCount = Math.min(
    cheapestByPrice.length,
    Math.max(CART_MAX_ITEMS - cartItems.length, 0),
  );
  const clampedSweepCount = Math.min(sweepCount, sweepMaxCount);
  const sweepPreviewTokenIds = useMemo(
    () => new Set(cheapestByPrice.slice(0, clampedSweepCount).map(([tokenId]) => tokenId)),
    [cheapestByPrice, clampedSweepCount],
  );

  function handleChange(nextAddress: string) {
    if (onNavigate) {
      onNavigate(`/collections/${nextAddress}`);
    }
  }

  function handleSweepCountChange(nextCount: number) {
    setSweepCount(Math.min(Math.max(nextCount, 0), sweepMaxCount));
  }

  function handleSweep() {
    const selected = sweepCandidates.slice(0, clampedSweepCount);
    if (selected.length === 0) return;

    addCandidates(selected);
    setCartOpen(true);
    setSweepCount(0);
  }

  return (
    <section className="w-full space-y-6 pb-20">
      {/* Collection header */}
      <div className="space-y-3 border-b border-border/60 pb-4">
        {runtimeCollections.length > 1 && (
          <Select value={address} onValueChange={handleChange}>
            <SelectTrigger aria-label="Collection" className="w-64">
              <SelectValue placeholder="Select collection" />
            </SelectTrigger>
            <SelectContent>
              {runtimeCollections.map((collectionEntry) => (
                <SelectItem
                  key={collectionEntry.address}
                  value={collectionEntry.address}
                >
                  {collectionEntry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {displayName ? (
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight text-muted-foreground">
            {selectedCollection?.name ?? address}
          </h1>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {totalSupply !== undefined && (
            <span>
              <span className="text-foreground font-medium">{Number(totalSupply).toLocaleString()}</span>
              {" "}items
            </span>
          )}
          {listingCount > 0 && (
            <span>
              <span className="text-foreground font-medium">{listingCountLabel}</span>
              {" "}listed
            </span>
          )}
          {floor && (
            <span className="flex items-center gap-1">
              Floor{" "}
              <span className="text-foreground font-medium">{floor.price}</span>
              <TokenSymbol address={floor.currency} className="text-foreground font-medium" />
            </span>
          )}
        </div>

        <Select value={sortMode} onValueChange={(value) => onSortModeChange?.(value as CollectionSortMode)}>
          <SelectTrigger aria-label="Sort tokens" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {collection.isSuccess && !collection.data ? (
          <p className="text-sm text-muted-foreground font-mono">
            <span className="text-primary mr-1">$</span>
            find collection -- not found
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="sticky top-20 self-start" data-testid="trait-sidebar-container">
          <TraitFilterSidebar
            activeFilters={resolvedActiveFilters}
            onActiveFiltersChange={onActiveFiltersChange}
            traitMetadata={traitMetadataQuery.data ?? []}
            isLoading={traitMetadataQuery.isLoading}
          />
        </div>

        <div className="w-full space-y-4" data-testid="collection-content-container">
          <Tabs defaultValue="tokens" className="w-full">
            <TabsList>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="market-activity">Market Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="tokens">
              <CollectionTokenGrid
                key={sweepScopeKey}
                activeFilters={resolvedActiveFilters}
                address={address}
                onTokensChange={(tokens) =>
                  setVisibleTokensByScope((current) => ({
                    ...current,
                    [sweepScopeKey]: tokens,
                  }))}
                projectId={projectId}
                sortMode={sortMode}
                sweepPreviewTokenIds={sweepPreviewTokenIds}
              />
            </TabsContent>
            <TabsContent value="market-activity">
              <CollectionMarketPanel address={address} projectId={projectId} />
            </TabsContent>
          </Tabs>
          <SweepBar
            candidates={sweepCandidates}
            count={sweepCount}
            maxCount={sweepMaxCount}
            onCountChange={handleSweepCountChange}
            onSweep={handleSweep}
          />
        </div>
      </div>
    </section>
  );
}
