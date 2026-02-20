"use client";

import { useMemo } from "react";
import {
  useCollectionListingsQuery,
  useCollectionQuery,
  useCollectionTraitMetadataQuery,
} from "@/lib/marketplace/hooks";
import {
  formatPriceForDisplay,
} from "@/lib/marketplace/token-display";
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
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { type CollectionSortMode } from "@/features/collections/collection-query-params";

const EMPTY_ACTIVE_FILTERS: ActiveFilters = {};

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

function floorPriceFromListings(
  cheapestListings: Map<string, { price: string }>,
): string | null {
  let min: bigint | null = null;

  for (const { price } of cheapestListings.values()) {
    try {
      const val = BigInt(price);
      if (min === null || val < min) {
        min = val;
      }
    } catch {
      // skip
    }
  }

  if (min === null) {
    return null;
  }

  return formatPriceForDisplay(min.toString());
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
  const collection = useCollectionQuery({ address, projectId, fetchImages: true });
  const traitMetadataQuery = useCollectionTraitMetadataQuery({ address, projectId });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    verifyOwnership: false,
  });

  const cheapestListings = cheapestListingByTokenId(listingQuery.data);
  const listingCount = Array.isArray(listingQuery.data) ? listingQuery.data.length : 0;
  const floorPrice = floorPriceFromListings(cheapestListings);
  const totalSupply = collection.data?.totalSupply;
  const displayName = collection.isSuccess && collection.data
    ? collectionName(collection.data.metadata, address)
    : null;

  function handleChange(nextAddress: string) {
    if (onNavigate) {
      onNavigate(`/collections/${nextAddress}`);
    }
  }

  return (
    <section className="w-full space-y-6">
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
              <span className="text-foreground font-medium">{listingCount}</span>
              {" "}listed
            </span>
          )}
          {floorPrice && (
            <span>
              Floor{" "}
              <span className="text-foreground font-medium">{floorPrice}</span>
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

        <Tabs defaultValue="tokens" className="w-full">
          <TabsList>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="market-activity">Market Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="tokens">
            <CollectionTokenGrid
              key={`${address}-${projectId ?? "default"}`}
              activeFilters={resolvedActiveFilters}
              address={address}
              projectId={projectId}
              sortMode={sortMode}
            />
          </TabsContent>
          <TabsContent value="market-activity">
            <CollectionMarketPanel address={address} projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
