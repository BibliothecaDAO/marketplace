"use client";

import Link from "next/link";
import {
  useCollectionListingsQuery,
  useCollectionTokensQuery,
} from "@/lib/marketplace/hooks";
import {
  displayTokenId,
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

  const tokens = tokenQuery.data?.page?.tokens ?? [];
  const listingPrices = cheapestListingByTokenId(listingQuery.data);

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
          {tokens.map((token) => (
            <div key={tokenId(token)} className="w-48 shrink-0 space-y-2">
              <MarketplaceTokenCard
                href={`/collections/${address}/${tokenId(token)}`}
                price={listingPrices.get(displayTokenId(token))?.price ?? tokenPrice(token)}
                token={token}
              />
              <Button
                className="w-full"
                disabled={!listingPrices.get(displayTokenId(token))}
                onClick={() => {
                  const listing = listingPrices.get(displayTokenId(token));
                  if (!listing) {
                    return;
                  }

                  addItem(
                    cartItemFromTokenListing(token, address, listing, projectId),
                  );
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Add to cart
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
