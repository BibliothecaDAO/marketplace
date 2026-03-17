"use client";

import { startTransition, useCallback, useEffect, useMemo, useReducer } from "react";
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

function cloneActiveFilters(activeFilters: ActiveFilters): ActiveFilters {
  return Object.fromEntries(
    Object.entries(activeFilters).map(([traitName, values]) => [
      traitName,
      new Set(values),
    ]),
  );
}

function cloneDiscoveryState(state: {
  activeFilters: ActiveFilters;
  sortMode: CollectionSortMode;
}) {
  return {
    activeFilters: cloneActiveFilters(state.activeFilters),
    sortMode: state.sortMode,
  };
}

type DiscoveryState = {
  activeFilters: ActiveFilters;
  sortMode: CollectionSortMode;
};

type OptimisticDiscoveryState = {
  searchParamsKey: string;
  state: DiscoveryState;
};

type OptimisticDiscoveryAction =
  | { type: "SYNC_FROM_URL"; searchParamsKey: string; state: DiscoveryState }
  | { type: "APPLY"; state: DiscoveryState };

function optimisticDiscoveryReducer(
  currentState: OptimisticDiscoveryState,
  action: OptimisticDiscoveryAction,
): OptimisticDiscoveryState {
  switch (action.type) {
    case "SYNC_FROM_URL":
      if (currentState.searchParamsKey === action.searchParamsKey) {
        return currentState;
      }

      return {
        searchParamsKey: action.searchParamsKey,
        state: cloneDiscoveryState(action.state),
      };
    case "APPLY":
      return {
        ...currentState,
        state: cloneDiscoveryState(action.state),
      };
  }
}

export function CollectionRouteContainer({
  address,
  cursor,
  collections,
}: CollectionRouteContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const discoveryState = useMemo(
    () =>
      collectionDiscoveryStateFromSearchParams(
        new URLSearchParams(searchParamsKey),
      ),
    [searchParamsKey],
  );
  const [optimisticDiscoveryState, dispatchOptimisticDiscoveryState] = useReducer(
    optimisticDiscoveryReducer,
    {
      searchParamsKey,
      state: cloneDiscoveryState(discoveryState),
    },
  );

  useEffect(() => {
    dispatchOptimisticDiscoveryState({
      type: "SYNC_FROM_URL",
      searchParamsKey,
      state: discoveryState,
    });
  }, [discoveryState, searchParamsKey]);

  const applyDiscoveryState = useCallback((nextState: {
    activeFilters: ActiveFilters;
    sortMode: CollectionSortMode;
  }) => {
    const clonedState = cloneDiscoveryState(nextState);
    const nextParams = collectionDiscoveryStateToSearchParams(
      new URLSearchParams(searchParamsKey),
      clonedState,
    );
    const query = nextParams.toString();

    dispatchOptimisticDiscoveryState({ type: "APPLY", state: clonedState });
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }, [pathname, router, searchParamsKey]);

  const handleActiveFiltersChange = useCallback(
    (nextFilters: ActiveFilters) => {
      applyDiscoveryState({
        activeFilters: nextFilters,
        sortMode: optimisticDiscoveryState.state.sortMode,
      });
    },
    [applyDiscoveryState, optimisticDiscoveryState.state.sortMode],
  );

  const handleSortModeChange = useCallback(
    (nextSortMode: CollectionSortMode) => {
      applyDiscoveryState({
        activeFilters: optimisticDiscoveryState.state.activeFilters,
        sortMode: nextSortMode,
      });
    },
    [applyDiscoveryState, optimisticDiscoveryState.state.activeFilters],
  );

  return (
    <CollectionRouteView
      activeFilters={optimisticDiscoveryState.state.activeFilters}
      address={address}
      cursor={cursor}
      collections={collections}
      onActiveFiltersChange={handleActiveFiltersChange}
      onNavigate={(href) => router.push(href)}
      onSortModeChange={handleSortModeChange}
      sortMode={optimisticDiscoveryState.state.sortMode}
    />
  );
}
