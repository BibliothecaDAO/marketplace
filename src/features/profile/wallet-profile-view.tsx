"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWalletPortfolioQuery } from "@/lib/marketplace/hooks";
import { formatNumberish } from "@/lib/marketplace/token-display";
import { CollectionHoldingSection } from "./collection-holding-section";

type WalletProfileViewProps = {
  address: string;
  title?: string;
  addressLabel?: string;
};

type PortfolioItem = {
  collectionAddress: string;
  tokenId: string;
  balance: string;
};

type GridDensityMode = "compact" | "standard";

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parsePortfolioItems(data: unknown): PortfolioItem[] {
  const page = asRecord(asRecord(data)?.page);
  const balances = Array.isArray(page?.balances)
    ? (page.balances as unknown[])
    : [];

  const items: PortfolioItem[] = [];
  for (const entry of balances) {
    const record = asRecord(entry);
    if (!record) continue;

    const collectionAddress =
      (typeof record.contract_address === "string" && record.contract_address) ||
      (typeof record.contractAddress === "string" && record.contractAddress) ||
      null;
    const tokenId = formatNumberish(record.token_id ?? record.tokenId);
    const balance = formatNumberish(record.balance) ?? "0";
    if (!collectionAddress || !tokenId) continue;

    try {
      if (BigInt(balance) <= BigInt(0)) {
        continue;
      }
    } catch {
      continue;
    }

    items.push({
      collectionAddress,
      tokenId,
      balance,
    });
  }

  return items;
}

function groupByCollection(
  items: PortfolioItem[],
): { collectionAddress: string; tokenIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const existing = map.get(item.collectionAddress) ?? [];
    existing.push(item.tokenId);
    map.set(item.collectionAddress, existing);
  }
  // Sort collections by item count descending
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([collectionAddress, tokenIds]) => ({ collectionAddress, tokenIds }));
}

export function WalletProfileView({
  address,
  title = "Wallet Profile",
  addressLabel = "Connected wallet address:",
}: WalletProfileViewProps) {
  const portfolioQuery = useWalletPortfolioQuery(address);
  const [filterInput, setFilterInput] = useState("");
  const [density, setDensity] = useState<GridDensityMode>("standard");

  const isLoading =
    portfolioQuery.status === "pending" || portfolioQuery.isFetching;
  const isError = portfolioQuery.status === "error" || !!portfolioQuery.error;

  const items = useMemo(
    () => parsePortfolioItems(portfolioQuery.data),
    [portfolioQuery.data],
  );

  const collections = useMemo(() => groupByCollection(items), [items]);

  const filteredCollections = useMemo(() => {
    const normalized = filterInput.trim().toLowerCase();
    if (!normalized) return collections;
    return collections
      .map(({ collectionAddress, tokenIds }) => ({
        collectionAddress,
        tokenIds: tokenIds.filter((id) => id.toLowerCase().includes(normalized)),
      }))
      .filter(
        ({ collectionAddress, tokenIds }) =>
          collectionAddress.toLowerCase().includes(normalized) ||
          tokenIds.length > 0,
      );
  }, [filterInput, collections]);

  const totalItems = items.length;
  const totalCollections = collections.length;

  return (
    <main
      className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      data-testid="wallet-profile-view"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{addressLabel}</p>
        <code className="block w-full overflow-x-auto rounded-sm border border-border/70 bg-muted/30 p-3 text-xs sm:text-sm">
          {address}
        </code>
      </div>

      {isLoading ? (
        <div data-testid="profile-loading" className="space-y-2 pt-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
                <div className="aspect-square w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Unable to load wallet items right now.
        </p>
      ) : totalItems === 0 ? (
        <p className="text-sm text-muted-foreground">
          No items found for this wallet.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {totalItems} item{totalItems !== 1 ? "s" : ""} across{" "}
              {totalCollections} collection{totalCollections !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Filter collection or token"
                className="h-8 w-48 text-xs"
                onChange={(e) => setFilterInput(e.target.value)}
                placeholder="Filter by token ID…"
                value={filterInput}
              />
              <div className="flex items-center gap-1">
                <Button
                  aria-pressed={density === "standard"}
                  className="h-8 px-2 text-xs"
                  onClick={() => setDensity("standard")}
                  size="sm"
                  type="button"
                  variant={density === "standard" ? "default" : "outline"}
                >
                  Standard
                </Button>
                <Button
                  aria-pressed={density === "compact"}
                  className="h-8 px-2 text-xs"
                  onClick={() => setDensity("compact")}
                  size="sm"
                  type="button"
                  variant={density === "compact" ? "default" : "outline"}
                >
                  Compact
                </Button>
              </div>
            </div>
          </div>

          {filteredCollections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items match the current filter.
            </p>
          ) : (
            <div className="space-y-8">
              {filteredCollections.map(({ collectionAddress, tokenIds }) => (
                <CollectionHoldingSection
                  collectionAddress={collectionAddress}
                  density={density}
                  key={collectionAddress}
                  tokenIds={tokenIds}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
