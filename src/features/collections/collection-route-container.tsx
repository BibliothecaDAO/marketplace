"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SeedCollection } from "@/lib/marketplace/config";
import { CollectionRouteView } from "@/features/collections/collection-route-view";
import {
  type ActiveFilters,
} from "@/lib/marketplace/traits";
import {
  collectionDiscoveryStateFromSearchParams,
  collectionDiscoveryStateToSearchParams,
  type CollectionSortMode,
} from "@/features/collections/collection-query-params";

type CollectionRouteContainerProps = {
  address: string;
  cursor?: string | null;
  collections?: SeedCollection[];
};

export function CollectionRouteContainer({
  address,
  cursor,
  collections,
}: CollectionRouteContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const discoveryState = useMemo(
    () =>
      collectionDiscoveryStateFromSearchParams(
        new URLSearchParams(searchParams.toString()),
      ),
    [searchParams],
  );
  const activeFilters = discoveryState.activeFilters;
  const sortMode = discoveryState.sortMode;

  const handleActiveFiltersChange = useCallback(
    (nextFilters: ActiveFilters) => {
      const nextParams = collectionDiscoveryStateToSearchParams(
        new URLSearchParams(searchParams.toString()),
        { activeFilters: nextFilters, sortMode },
      );
      const query = nextParams.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, sortMode, pathname, router],
  );

  const handleSortModeChange = useCallback(
    (nextSortMode: CollectionSortMode) => {
      const nextParams = collectionDiscoveryStateToSearchParams(
        new URLSearchParams(searchParams.toString()),
        { activeFilters, sortMode: nextSortMode },
      );
      const query = nextParams.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, activeFilters, pathname, router],
  );

  return (
    <CollectionRouteView
      activeFilters={activeFilters}
      address={address}
      cursor={cursor}
      collections={collections}
      onActiveFiltersChange={handleActiveFiltersChange}
      onNavigate={(href) => router.push(href)}
      onSortModeChange={handleSortModeChange}
      sortMode={sortMode}
    />
  );
}
