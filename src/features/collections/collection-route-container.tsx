"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SeedCollection } from "@/lib/marketplace/config";
import { CollectionRouteView } from "@/features/collections/collection-route-view";
import {
  activeFiltersFromSearchParams,
  activeFiltersToSearchParams,
  type ActiveFilters,
} from "@/lib/marketplace/traits";

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
  const activeFilters = useMemo(
    () => activeFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  function handleActiveFiltersChange(nextFilters: ActiveFilters) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("cursor");
    nextParams.delete("trait");

    const traitParams = activeFiltersToSearchParams(nextFilters);
    traitParams.getAll("trait").forEach((entry) => {
      nextParams.append("trait", entry);
    });

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <CollectionRouteView
      activeFilters={activeFilters}
      address={address}
      cursor={cursor}
      collections={collections}
      onActiveFiltersChange={handleActiveFiltersChange}
      onNavigate={(href) => router.push(href)}
    />
  );
}
