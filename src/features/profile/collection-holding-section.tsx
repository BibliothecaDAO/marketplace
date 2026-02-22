"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectionQuery, useCollectionTokensQuery } from "@/lib/marketplace/hooks";
import { tokenId } from "@/lib/marketplace/token-display";
import { cn } from "@/lib/utils";

// Expand each token ID to include both decimal and hex variants so the SDK
// can match whichever format it stores internally (mirrors CollectionTokenGrid).
function expandTokenIds(ids: string[]): string[] {
  const expanded = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    expanded.add(id);
    if (/^\d+$/.test(id)) {
      try { expanded.add(`0x${BigInt(id).toString(16)}`); } catch { /* skip */ }
    } else if (/^0x[0-9a-fA-F]+$/.test(id)) {
      try { expanded.add(BigInt(id).toString()); } catch { /* skip */ }
    }
  }
  return Array.from(expanded);
}

type GridDensityMode = "compact" | "standard";

const GRID_CLASSES: Record<GridDensityMode, string> = {
  compact: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5",
  standard: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

type CollectionHoldingSectionProps = {
  collectionAddress: string;
  tokenIds: string[];
  density: GridDensityMode;
};

export function CollectionHoldingSection({
  collectionAddress,
  tokenIds,
  density,
}: CollectionHoldingSectionProps) {
  const expandedTokenIds = useMemo(() => expandTokenIds(tokenIds), [tokenIds]);

  const collectionQuery = useCollectionQuery({ address: collectionAddress });
  const tokensQuery = useCollectionTokensQuery({
    address: collectionAddress,
    tokenIds: expandedTokenIds,
    limit: expandedTokenIds.length,
    fetchImages: true,
  });

  const collectionName = resolveCollectionName(
    collectionQuery.data?.metadata,
    collectionAddress,
  );

  const tokens = tokensQuery.data?.page?.tokens ?? [];
  const isLoading = tokensQuery.isLoading;
  const gridClasses = GRID_CLASSES[density];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <h2 className="text-sm font-semibold">{collectionName}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tokenIds.length}
        </span>
      </div>

      {isLoading ? (
        <div className={cn("grid gap-3", gridClasses)}>
          {tokenIds.map((id) => (
            <Card key={id}>
              <CardContent className="space-y-2 p-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tokensQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Failed to load tokens for this collection.
          </CardContent>
        </Card>
      ) : (
        <div className={cn("grid gap-3", gridClasses)}>
          {tokens.map((token) => (
            <MarketplaceTokenCard
              key={tokenId(token)}
              token={token}
              href={`/collections/${collectionAddress}/${tokenId(token)}`}
              linkAriaLabel={`View token ${tokenId(token)}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function resolveCollectionName(metadata: unknown, fallbackAddress: string): string {
  if (metadata && typeof metadata === "object") {
    const name = (metadata as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }
  return fallbackAddress;
}
