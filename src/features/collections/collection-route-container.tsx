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
  type MarketplaceCurrencySymbol,
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
  currency: MarketplaceCurrencySymbol;
}) {
  return {
    activeFilters: cloneActiveFilters(state.activeFilters),
    sortMode: state.sortMode,
    currency: state.currency,
  };
}

type DiscoveryState = {
  activeFilters: ActiveFilters;
  sortMode: CollectionSortMode;
  currency: MarketplaceCurrencySymbol;
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
    currency: MarketplaceCurrencySymbol;
  }) => {
    const clonedState = cloneDiscoveryState(nextState);
    const nextParams = collectionDiscoveryStateToSearchParams(
      new URLSearchParams(searchParamsKey),
      clonedState,
    );
    const query = nextParams.toString();

    dispatchOptimisticDiscoveryState({ type: "APPLY", state: clonedState });
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }, [pathname, router, searchParamsKey]);

  const handleActiveFiltersChange = useCallback(
    (nextFilters: ActiveFilters) => {
      applyDiscoveryState({
        activeFilters: nextFilters,
        sortMode: optimisticDiscoveryState.state.sortMode,
        currency: optimisticDiscoveryState.state.currency,
      });
    },
    [
      applyDiscoveryState,
      optimisticDiscoveryState.state.currency,
      optimisticDiscoveryState.state.sortMode,
    ],
  );

  const handleSortModeChange = useCallback(
    (nextSortMode: CollectionSortMode) => {
      applyDiscoveryState({
        activeFilters: optimisticDiscoveryState.state.activeFilters,
        sortMode: nextSortMode,
        currency: optimisticDiscoveryState.state.currency,
      });
    },
    [
      applyDiscoveryState,
      optimisticDiscoveryState.state.activeFilters,
      optimisticDiscoveryState.state.currency,
    ],
  );

  const handleCurrencyChange = useCallback(
    (currency: MarketplaceCurrencySymbol) => {
      applyDiscoveryState({
        activeFilters: optimisticDiscoveryState.state.activeFilters,
        sortMode: optimisticDiscoveryState.state.sortMode,
        currency,
      });
    }, [applyDiscoveryState, optimisticDiscoveryState.state],
  );

  const handleCursorChange = useCallback((nextCursor: string | null) => {
    const nextParams = new URLSearchParams(searchParamsKey);
    if (nextCursor) nextParams.set("cursor", nextCursor);
    else nextParams.delete("cursor");
    const query = nextParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }, [pathname, router, searchParamsKey]);

  return (
    <CollectionRouteView
      activeFilters={optimisticDiscoveryState.state.activeFilters}
      address={address}
      cursor={cursor}
      currency={optimisticDiscoveryState.state.currency}
      collections={collections}
      onActiveFiltersChange={handleActiveFiltersChange}
      onSortModeChange={handleSortModeChange}
      onCurrencyChange={handleCurrencyChange}
      onCursorChange={handleCursorChange}
      sortMode={optimisticDiscoveryState.state.sortMode}
    />
  );
}
