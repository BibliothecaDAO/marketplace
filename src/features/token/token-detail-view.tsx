"use client";

import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import { useTokenDetailQuery } from "@/lib/marketplace/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type TokenDetailViewProps = {
  address: string;
  tokenId: string;
  projectId?: string;
};

type TokenAttribute = {
  trait_type: string;
  value: string;
};

type TokenMetadata = {
  name?: string;
  attributes?: TokenAttribute[];
  image?: string;
  image_url?: string;
};

function getTokenName(token: NormalizedToken) {
  const meta = token.metadata as TokenMetadata | null;
  const name = meta?.name;
  return typeof name === "string" && name.trim()
    ? name
    : `Token #${String(token.token_id ?? "unknown")}`;
}

function getTokenImage(token: NormalizedToken) {
  if (token.image) return token.image;
  const meta = token.metadata as TokenMetadata | null;
  const source = meta?.image ?? meta?.image_url;
  return typeof source === "string" && source.length > 0 ? source : null;
}

function getTokenAttributes(token: NormalizedToken): TokenAttribute[] {
  const meta = token.metadata as TokenMetadata | null;
  return Array.isArray(meta?.attributes) ? meta.attributes : [];
}

export function TokenDetailView({
  address,
  tokenId,
  projectId,
}: TokenDetailViewProps) {
  const detailQuery = useTokenDetailQuery({
    collection: address,
    tokenId,
    projectId,
    fetchImages: true,
  });

  const token = detailQuery.data?.token ?? null;
  const listings = detailQuery.data?.listings ?? [];

  if (detailQuery.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton
          className="aspect-square w-full"
          data-testid="token-detail-skeleton"
        />
        <div className="space-y-4">
          <Skeleton
            className="h-8 w-2/3"
            data-testid="token-detail-skeleton"
          />
          <Skeleton
            className="h-4 w-1/3"
            data-testid="token-detail-skeleton"
          />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Token not found.
        </CardContent>
      </Card>
    );
  }

  const name = getTokenName(token);
  const image = getTokenImage(token);
  const attributes = getTokenAttributes(token);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Token image */}
        <div className="flex aspect-square items-center justify-center bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={name}
              className="h-full w-full object-cover"
              src={image}
            />
          ) : (
            <span className="text-sm text-muted-foreground">No Image</span>
          )}
        </div>

        {/* Token details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{name}</h1>
            <p className="text-sm text-primary font-mono">
              #{String(token.token_id ?? "unknown")}
            </p>
          </div>

          {/* Attributes */}
          {attributes.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Attributes</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {attributes.map((attr) => (
                  <Card key={`${attr.trait_type}-${attr.value}`} className="border-border/70">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {attr.trait_type}
                      </p>
                      <p className="text-sm font-medium text-primary">{attr.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Listings section */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Listings</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings</p>
        ) : (
          <div className="space-y-2">
            {listings.map((listing: { id: number; price: number; owner: string; expiration?: number }) => (
              <Card key={listing.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-primary font-mono">
                      {listing.price}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {listing.owner}
                    </p>
                  </div>
                  {listing.expiration ? (
                    <Badge variant="secondary">{listing.expiration}</Badge>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
