"use client";

import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { CollectionRow } from "@/components/marketplace/collection-row";

export function MarketplaceHome() {
  const { collections } = getMarketplaceRuntimeConfig();

  return (
    <main
      data-testid="marketplace-home"
      className="w-full space-y-8 px-4 sm:px-6 lg:px-8"
    >
      {collections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No collections configured
        </p>
      ) : (
        collections.map((collection) => (
          <CollectionRow
            key={collection.address}
            address={collection.address}
            name={collection.name}
            projectId={collection.projectId}
          />
        ))
      )}
    </main>
  );
}
