"use client";

import Link from "next/link";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import { useCollectionTokensQuery } from "@/lib/marketplace/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CollectionRowProps = {
  address: string;
  name: string;
  projectId?: string;
};

function tokenId(token: NormalizedToken) {
  return String(token.token_id ?? "unknown");
}

function tokenName(token: NormalizedToken) {
  const meta = token.metadata as Record<string, unknown> | null;
  const name = meta?.name;
  return typeof name === "string" && name.trim() ? name : `Token #${tokenId(token)}`;
}

function tokenImage(token: NormalizedToken) {
  if (token.image) return token.image;
  const meta = token.metadata as Record<string, unknown> | null;
  const source = meta?.image ?? meta?.image_url;
  return typeof source === "string" && source.length > 0 ? source : null;
}

export function CollectionRow({ address, name, projectId }: CollectionRowProps) {
  const tokenQuery = useCollectionTokensQuery({
    address,
    project: projectId,
    limit: 12,
    fetchImages: true,
  });

  const tokens = tokenQuery.data?.page?.tokens ?? [];

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

      {tokenQuery.isSuccess && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono">
          <span className="text-primary mr-1">$</span>
          ls tokens/ -- (empty)
        </p>
      ) : null}

      {tokenQuery.isSuccess && tokens.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {tokens.map((token) => {
            const image = tokenImage(token);
            return (
              <Link
                key={tokenId(token)}
                href={`/collections/${address}/${tokenId(token)}`}
                className="group block w-48 shrink-0 transition-transform duration-150 hover:-translate-y-0.5"
              >
                <Card className="transition-colors duration-150 group-hover:border-primary/30">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex aspect-square items-center justify-center bg-muted">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={tokenName(token)}
                          className="h-full w-full object-cover"
                          src={image}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No Image
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{tokenName(token)}</p>
                    <p className="text-xs text-muted-foreground">
                      #{tokenId(token)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
