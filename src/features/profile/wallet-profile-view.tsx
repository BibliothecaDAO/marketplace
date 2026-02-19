"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWalletPortfolioQuery } from "@/lib/marketplace/hooks";
import { formatNumberish } from "@/lib/marketplace/token-display";

type WalletProfileViewProps = {
  address: string;
};

type PortfolioItem = {
  collectionAddress: string;
  tokenId: string;
  balance: string;
};

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

export function WalletProfileView({ address }: WalletProfileViewProps) {
  const portfolioQuery = useWalletPortfolioQuery(address);
  const isLoading =
    portfolioQuery.status === "loading" || portfolioQuery.isFetching;
  const isError = portfolioQuery.status === "error" || !!portfolioQuery.error;
  const items = useMemo(
    () => parsePortfolioItems(portfolioQuery.data),
    [portfolioQuery.data],
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Wallet Profile</h1>
      <p className="text-sm text-muted-foreground">Connected wallet address:</p>
      <code className="w-full overflow-x-auto rounded-sm border border-border/70 bg-muted/30 p-3 text-xs sm:text-sm">
        {address}
      </code>

      <h2 className="pt-2 text-lg font-medium">Owned items</h2>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading wallet items...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Unable to load wallet items right now.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No items found for this wallet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              className="flex items-center justify-between gap-3 rounded-sm border border-border/70 p-3"
              key={`${item.collectionAddress}:${item.tokenId}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.collectionAddress}
                </p>
                <p className="text-xs text-muted-foreground">#{item.tokenId}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-primary">
                  x{item.balance}
                </span>
                <Link
                  aria-label={`View token ${item.tokenId}`}
                  className="text-xs underline-offset-4 hover:underline"
                  href={`/collections/${item.collectionAddress}/${item.tokenId}`}
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
