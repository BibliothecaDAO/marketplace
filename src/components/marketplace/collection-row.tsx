"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
  formatNumberish,
  listingPriceByTokenId,
  tokenId,
  tokenPrice,
} from "@/lib/marketplace/token-display";
import { MarketplaceTokenCard } from "@/components/marketplace/token-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useCartStore } from "@/features/cart/store/cart-store";

type CollectionRowProps = {
  address: string;
  name: string;
  projectId?: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function fallbackTokensFromListings(
  listings: unknown[] | undefined,
  limit: number,
) {
  const tokenIds: string[] = [];
  const seen = new Set<string>();

  for (const listing of listings ?? []) {
    const fields = asRecord(listing);
    if (!fields) {
      continue;
    }

    const nestedOrder = asRecord(fields.order);
    const normalizedTokenId =
      formatNumberish(fields.tokenId) ??
      formatNumberish(fields.token_id) ??
      formatNumberish(nestedOrder?.tokenId) ??
      formatNumberish(nestedOrder?.token_id);
    if (!normalizedTokenId || seen.has(normalizedTokenId)) {
      continue;
    }

    seen.add(normalizedTokenId);
    tokenIds.push(normalizedTokenId);
    if (tokenIds.length >= limit) {
      break;
    }
  }

  return tokenIds.map(
    (resolvedTokenId) =>
      ({
        token_id: resolvedTokenId,
        metadata: {},
      }) as NormalizedToken,
  );
}

function listingTokenIds(listings: unknown[] | undefined, limit: number) {
  const ids = fallbackTokensFromListings(listings, limit).map((token) =>
    String(token.token_id ?? "").trim(),
  );
  const expanded = new Set<string>();

  for (const id of ids) {
    if (!id) {
      continue;
    }

    expanded.add(id);

    if (/^\d+$/.test(id)) {
      try {
        expanded.add(`0x${BigInt(id).toString(16)}`);
      } catch {
        // Skip malformed token IDs.
      }
    }
  }

  return Array.from(expanded);
}

export function CollectionRow({ address, name, projectId }: CollectionRowProps) {
  const addItem = useCartStore((state) => state.addItem);
  const tokenQuery = useCollectionTokensQuery({
    address,
    project: projectId,
    limit: 12,
    fetchImages: true,
  });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    projectId,
    verifyOwnership: false,
  });
  const listedTokenIds = useMemo(
    () => listingTokenIds(listingQuery.data, 12),
    [listingQuery.data],
  );
  const listedTokensQuery = useCollectionTokensQuery({
    address,
    project: projectId,
    tokenIds: listedTokenIds.length > 0 ? listedTokenIds : undefined,
    limit: 12,
    fetchImages: true,
  });

  const tokens = useMemo(
    () => tokenQuery.data?.page?.tokens ?? [],
    [tokenQuery.data?.page?.tokens],
  );
  const fallbackTokens = useMemo(() => {
    const requestedIds = new Set(listedTokenIds);
    const listedTokens = (listedTokensQuery.data?.page?.tokens ?? []).filter(
      (token) => requestedIds.has(displayTokenId(token)),
    );
    if (listedTokens.length > 0) {
      return listedTokens;
    }

    return fallbackTokensFromListings(listingQuery.data, 12);
  }, [listedTokenIds, listedTokensQuery.data?.page?.tokens, listingQuery.data]);
  const cheapestListings = cheapestListingByTokenId(listingQuery.data);
  const listingPrices = listingPriceByTokenId(listingQuery.data);
  const tokensForDisplay = useMemo(() => {
    if (tokens.length === 0) {
      return fallbackTokens;
    }

    const hasListings = cheapestListings.size > 0 || listingPrices.size > 0;
    if (!hasListings) {
      return tokens;
    }

    const pricedTokens = tokens.filter((token) => {
      const key = displayTokenId(token);
      return cheapestListings.has(key) || listingPrices.has(key);
    });
    if (pricedTokens.length > 0) {
      return pricedTokens;
    }

    return fallbackTokens.length > 0 ? fallbackTokens : tokens;
  }, [cheapestListings, fallbackTokens, listingPrices, tokens]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
        <Link href={`/collections/${address}`}>{name}</Link>
      </h2>

      {tokenQuery.isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="w-48 shrink-0">
              <CardContent className="space-y-2 p-3">
                <Skeleton
                  className="h-40 w-full"
                  data-testid="collection-row-skeleton"
                />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tokenQuery.isSuccess &&
      tokensForDisplay.length === 0 &&
      !listingQuery.isLoading ? (
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-primary mr-1">$</span>
          ls tokens/ -- (empty)
        </p>
      ) : null}

      {tokenQuery.isSuccess && tokensForDisplay.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {tokensForDisplay.map((token) => {
            const tokenKey = displayTokenId(token);
            const cheapestListing = cheapestListings.get(tokenKey);
            const price =
              cheapestListing?.price ??
              listingPrices.get(tokenKey) ??
              tokenPrice(token);

            return (
              <div key={tokenId(token)} className="w-48 shrink-0 space-y-2">
                <MarketplaceTokenCard
                  href={`/collections/${address}/${tokenId(token)}`}
                  price={price}
                  token={token}
                />
                <Button
                  className="w-full"
                  disabled={!cheapestListing}
                  onClick={() => {
                    if (!cheapestListing) {
                      return;
                    }

                    addItem(
                      cartItemFromTokenListing(
                        token,
                        address,
                        cheapestListing,
                        projectId,
                      ),
                    );
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Add to cart
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
