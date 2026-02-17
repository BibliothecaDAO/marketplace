"use client";

import { useMemo, useState } from "react";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useMarketplaceClient,
  useMarketplaceCollection,
  useMarketplaceCollectionListings,
  useMarketplaceCollectionTokens,
} from "@cartridge/arcade/marketplace/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";

const runtimeConfig = getMarketplaceRuntimeConfig();

function formatAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function tokenMetadata(token: NormalizedToken) {
  if (!token.metadata || typeof token.metadata !== "object") {
    return null;
  }

  return token.metadata as Record<string, unknown>;
}

function tokenId(token: NormalizedToken) {
  return String(token.token_id ?? "unknown");
}

function tokenName(token: NormalizedToken) {
  const metadata = tokenMetadata(token);
  const metadataName = metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName;
  }

  return `Token #${tokenId(token)}`;
}

function tokenImage(token: NormalizedToken) {
  if (token.image) {
    return token.image;
  }

  const metadata = tokenMetadata(token);
  const source = metadata?.image ?? metadata?.image_url;
  return typeof source === "string" && source.length > 0 ? source : null;
}

function queryTone(status: string) {
  switch (status) {
    case "error":
      return "destructive";
    case "success":
      return "secondary";
    default:
      return "outline";
  }
}

export function MarketplaceShell() {
  const [selectedAddress, setSelectedAddress] = useState<string>(
    runtimeConfig.collections[0]?.address ?? "",
  );
  const [search, setSearch] = useState("");
  const selectedCollection = useMemo(
    () =>
      runtimeConfig.collections.find((collection) => collection.address === selectedAddress) ??
      runtimeConfig.collections[0],
    [selectedAddress],
  );

  const isCollectionSelected = Boolean(selectedCollection?.address);
  const collectionAddress = selectedCollection?.address ?? "0x0";
  const projectId = selectedCollection?.projectId;
  const client = useMarketplaceClient();
  const collection = useMarketplaceCollection(
    {
      address: collectionAddress,
      fetchImages: true,
      projectId,
    },
    isCollectionSelected,
  );
  const tokens = useMarketplaceCollectionTokens(
    {
      address: collectionAddress,
      fetchImages: true,
      limit: 24,
      project: projectId,
    },
    isCollectionSelected,
  );
  const listings = useMarketplaceCollectionListings(
    {
      collection: collectionAddress,
      limit: 24,
      projectId,
    },
    isCollectionSelected,
  );

  const tokenRows = tokens.data?.page?.tokens ?? [];
  const filteredTokens = tokenRows.filter((token) =>
    tokenName(token).toLowerCase().includes(search.toLowerCase().trim()),
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Biblio Marketplace
              </p>
              <CardTitle className="text-2xl leading-tight sm:text-3xl">
                Shadcn + Tailwind starter powered by Arcade marketplace SDK
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Chain: {runtimeConfig.chainLabel}</Badge>
              <Badge variant={queryTone(client.status)}>Client: {client.status}</Badge>
              <Badge variant="outline">
                Collections: {runtimeConfig.collections.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  Active Collection
                </p>
                <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {runtimeConfig.collections.map((collectionOption) => (
                      <SelectItem
                        key={collectionOption.address}
                        value={collectionOption.address}
                      >
                        {collectionOption.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  Quick Search
                </p>
                <Input
                  placeholder="Filter loaded tokens by name"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={!isCollectionSelected}
                />
              </div>
            </div>

            {!isCollectionSelected && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  No collection is configured yet. Add
                  `NEXT_PUBLIC_MARKETPLACE_COLLECTIONS` in `.env.local` using
                  `address|name|projectId` entries.
                </CardContent>
              </Card>
            )}

            {runtimeConfig.warnings.length > 0 && (
              <Card className="border-destructive/30">
                <CardContent className="space-y-2 pt-6">
                  {runtimeConfig.warnings.map((warning) => (
                    <p key={warning} className="text-xs text-destructive">
                      {warning}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {isCollectionSelected && (
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Address
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm">{formatAddress(collectionAddress)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Tokens Loaded
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm">{tokenRows.length}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Active Listings
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {listings.data?.length ?? 0}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">Token Grid</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={queryTone(tokens.status)}>
                    Tokens: {tokens.status}
                  </Badge>
                  <Badge variant={queryTone(collection.status)}>
                    Collection: {collection.status}
                  </Badge>
                </div>
              </div>
              <Separator />
            </CardHeader>
            <CardContent>
              {tokens.status === "loading" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={`skeleton-${index}`} className="overflow-hidden">
                      <Skeleton className="aspect-square w-full rounded-none" />
                      <CardContent className="space-y-2 p-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {tokens.status !== "loading" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredTokens.map((token) => {
                    const image = tokenImage(token);
                    return (
                      <Card key={tokenId(token)} className="overflow-hidden">
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
                        <CardContent className="space-y-1 p-3">
                          <p className="truncate text-sm font-medium">{tokenName(token)}</p>
                          <p className="text-xs text-muted-foreground">
                            Token ID: {tokenId(token)}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {tokens.status === "success" && filteredTokens.length === 0 && (
                    <Card className="col-span-full border-dashed">
                      <CardContent className="pt-6 text-sm text-muted-foreground">
                        No tokens matched the current filters.
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
