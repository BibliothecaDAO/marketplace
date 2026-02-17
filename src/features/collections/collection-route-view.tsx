"use client";

import { useMemo, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import { useCollectionQuery } from "@/lib/marketplace/hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const EMPTY_ACTIVE_FILTERS: ActiveFilters = {};

type CollectionRouteViewProps = {
  address: string;
  cursor?: string | null;
  collections?: SeedCollection[];
  activeFilters?: ActiveFilters;
  onActiveFiltersChange?: (filters: ActiveFilters) => void;
  onNavigate?: (href: string) => void;
};

function collectionName(metadata: unknown, fallbackAddress: string) {
  if (metadata && typeof metadata === "object") {
    const name = (metadata as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }

  return fallbackAddress;
}

export function CollectionRouteView({
  address,
  cursor,
  collections,
  activeFilters,
  onActiveFiltersChange,
  onNavigate,
}: CollectionRouteViewProps) {
  const [loadedTokens, setLoadedTokens] = useState<NormalizedToken[]>([]);
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

  function handleChange(nextAddress: string) {
    if (onNavigate) {
      onNavigate(`/collections/${nextAddress}`);
    }
  }

  return (
    <section className="w-full space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium tracking-widest uppercase">Collection</CardTitle>
            <Badge variant="outline">Cursor: {cursor ?? "none"}</Badge>
          </div>
          <Select value={address} onValueChange={handleChange}>
            <SelectTrigger aria-label="Collection">
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
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{address}</p>
          {collection.isSuccess && collection.data ? (
            <div className="space-y-1">
              <p className="text-lg font-medium">
                {collectionName(collection.data.metadata, address)}
              </p>
              <p className="text-sm text-muted-foreground">
                Contract Type: {collection.data.contractType}
              </p>
            </div>
          ) : null}

          {collection.isSuccess && !collection.data ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-sm text-muted-foreground font-mono">
                <span className="text-primary mr-1">$</span>
                find collection -- not found
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="sticky top-20 self-start" data-testid="trait-sidebar-container">
          <TraitFilterSidebar
            activeFilters={resolvedActiveFilters}
            onActiveFiltersChange={onActiveFiltersChange}
            tokens={loadedTokens}
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
              onTokensChange={setLoadedTokens}
              projectId={projectId}
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
