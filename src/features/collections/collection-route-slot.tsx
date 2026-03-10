"use client";

import { useEffect, useState } from "react";
import type { SeedCollection } from "@/lib/marketplace/config";

type CollectionRouteSlotProps = {
  address: string;
  cursor?: string | null;
  collections?: SeedCollection[];
};

type CollectionRouteContainerComponent =
  typeof import("@/features/collections/collection-route-container").CollectionRouteContainer;

export function CollectionRouteSlot({
  address,
  cursor,
  collections,
}: CollectionRouteSlotProps) {
  const [Component, setComponent] =
    useState<CollectionRouteContainerComponent | null>(null);

  useEffect(() => {
    let active = true;

    // Load the interactive collection route client after the edge shell hydrates.
    void import("@/features/collections/collection-route-container").then(
      (module) => {
        if (active) {
          setComponent(() => module.CollectionRouteContainer);
        }
      },
    );

    return () => {
      active = false;
    };
  }, []);

  if (!Component) {
    return null;
  }

  return (
    <Component address={address} cursor={cursor} collections={collections} />
  );
}
