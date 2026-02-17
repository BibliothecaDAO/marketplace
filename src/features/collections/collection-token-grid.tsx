"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import { useMarketplaceCollectionTokens } from "@cartridge/arcade/marketplace/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ActiveFilters,
  filterTokensByActiveFilters,
} from "@/lib/marketplace/traits";

type CollectionTokenGridProps = {
  address: string;
  projectId?: string;
  limit?: number;
  tokenIds?: string[];
  activeFilters?: ActiveFilters;
  onTokensChange?: (tokens: NormalizedToken[]) => void;
};

function tokenId(token: NormalizedToken) {
  return String(token.token_id ?? "unknown");
}

function tokenName(token: NormalizedToken) {
  if (token.metadata && typeof token.metadata === "object") {
    const name = (token.metadata as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }

  return `Token #${tokenId(token)}`;
}

function tokenImage(token: NormalizedToken) {
  if (token.image) {
    return token.image;
  }

  if (token.metadata && typeof token.metadata === "object") {
    const metadata = token.metadata as Record<string, unknown>;
    const source = metadata.image ?? metadata.image_url;
    if (typeof source === "string" && source.length > 0) {
      return source;
    }
  }

  return null;
}

function dedupeTokens(tokens: NormalizedToken[]) {
  const unique = new Map<string, NormalizedToken>();

  tokens.forEach((item) => {
    unique.set(tokenId(item), item);
  });

  return Array.from(unique.values());
}

function tokenSignature(tokens: NormalizedToken[]) {
  return tokens.map((item) => tokenId(item)).join(",");
}

export function CollectionTokenGrid({
  address,
  projectId,
  limit = 24,
  tokenIds,
  activeFilters,
  onTokensChange,
}: CollectionTokenGridProps) {
  const tokenIdsKey = useMemo(() => tokenIds?.join(",") ?? "", [tokenIds]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [tokens, setTokens] = useState<NormalizedToken[]>([]);

  const tokenQuery = useMarketplaceCollectionTokens(
    {
      address,
      project: projectId,
      limit,
      tokenIds,
      cursor,
      fetchImages: true,
    },
    Boolean(address),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens([]);
  }, [address, projectId, limit, tokenIdsKey]);

  useEffect(() => {
    if (tokenQuery.status !== "success") {
      return;
    }

    const pageTokens = tokenQuery.data?.page?.tokens ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens((previous) => {
      const next = !cursor
        ? dedupeTokens(pageTokens)
        : dedupeTokens([...previous, ...pageTokens]);

      return tokenSignature(previous) === tokenSignature(next) ? previous : next;
    });
  }, [cursor, tokenQuery.data, tokenQuery.status]);

  useEffect(() => {
    onTokensChange?.(tokens);
  }, [tokens, onTokensChange]);

  const nextCursor = tokenQuery.data?.page?.nextCursor ?? null;
  const canLoadMore = Boolean(nextCursor);
  const visibleTokens = useMemo(
    () =>
      activeFilters && Object.keys(activeFilters).length > 0
        ? filterTokensByActiveFilters(tokens, activeFilters)
        : tokens,
    [activeFilters, tokens],
  );

  return (
    <section className="space-y-4">
      {tokenQuery.status === "loading" && tokens.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`token-skeleton-${index}`}>
              <CardContent className="space-y-2 p-3">
                <Skeleton className="h-40 w-full" data-testid="token-skeleton" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tokenQuery.status === "error" ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Failed to load tokens.
          </CardContent>
        </Card>
      ) : null}

      {tokenQuery.status !== "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTokens.map((token) => {
            const image = tokenImage(token);
            return (
              <Card key={tokenId(token)}>
                <CardContent
                  aria-label={`token-${tokenId(token)}`}
                  className="space-y-2 p-3"
                  role="article"
                >
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={tokenName(token)}
                        className="h-full w-full object-cover"
                        src={image}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No Image</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{tokenName(token)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {tokenQuery.status === "success" && visibleTokens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No tokens matched the active trait filters.
          </CardContent>
        </Card>
      ) : null}

      {canLoadMore ? (
        <Button
          disabled={tokenQuery.isFetching}
          onClick={() => {
            if (nextCursor) {
              setCursor(nextCursor);
            }
          }}
          type="button"
        >
          Load more
        </Button>
      ) : null}
    </section>
  );
}
