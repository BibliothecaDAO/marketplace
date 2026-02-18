"use client";

import { useEffect, useMemo, useState } from "react";
import { ArcadeProvider } from "@cartridge/arcade";
import { useAccount } from "@starknet-react/core";
import type { NormalizedToken } from "@cartridge/arcade/marketplace";
import {
  useCollectionListingsQuery,
  useTokenDetailQuery,
} from "@/lib/marketplace/hooks";
import { getMarketplaceRuntimeConfig } from "@/lib/marketplace/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { displayTokenId } from "@/lib/marketplace/token-display";
import {
  cartItemFromTokenListing,
  cheapestListingByTokenId,
} from "@/features/cart/listing-utils";
import { useCartStore } from "@/features/cart/store/cart-store";

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

type ListingRow = {
  id: number;
  tokenId?: number | string;
  quantity?: number | string;
  price: number | string;
  currency?: string;
  owner: string;
  expiration?: number;
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
  const addItem = useCartStore((state) => state.addItem);
  const { account, address: walletAddress, isConnected } = useAccount();
  const {
    sdkConfig: { chainId },
  } = getMarketplaceRuntimeConfig();
  const marketplaceProvider = useMemo(
    () => new ArcadeProvider(chainId),
    [chainId],
  );
  const [verifyOwnership, setVerifyOwnership] = useState(false);
  const [priceInput, setPriceInput] = useState("1000000000000000000");
  const [quantityInput, setQuantityInput] = useState("1");
  const [currencyInput, setCurrencyInput] = useState("0x0");
  const [expirationInput, setExpirationInput] = useState(() =>
    String(Math.floor(Date.now() / 1000) + 60 * 60 * 24),
  );
  const [txStatus, setTxStatus] = useState<{
    tone: "idle" | "success" | "error";
    message: string;
  }>({ tone: "idle", message: "" });
  const [pendingAction, setPendingAction] = useState<
    "list" | "offer" | "cancel" | null
  >(null);
  const detailQuery = useTokenDetailQuery({
    collection: address,
    tokenId,
    projectId,
    fetchImages: true,
  });
  const listingQuery = useCollectionListingsQuery({
    collection: address,
    tokenId,
    projectId,
    verifyOwnership,
  });

  const token = detailQuery.data?.token ?? null;
  const listings = useMemo(
    () => listingQuery.data ?? detailQuery.data?.listings ?? [],
    [detailQuery.data?.listings, listingQuery.data],
  );
  const listingRows = listings as ListingRow[];
  const cheapestListings = useMemo(
    () => cheapestListingByTokenId(listings as unknown[]),
    [listings],
  );
  const cheapestListing = useMemo(() => {
    if (!token) {
      return null;
    }

    return cheapestListings.get(displayTokenId(token)) ?? null;
  }, [cheapestListings, token]);
  const ownListing = useMemo(() => {
    if (!walletAddress) return null;
    return (
      listingRows.find(
        (listing) => listing.owner.toLowerCase() === walletAddress.toLowerCase(),
      ) ?? null
    );
  }, [listingRows, walletAddress]);

  useEffect(() => {
    if (currencyInput !== "0x0") return;

    const listedCurrency = listingRows.find(
      (listing) =>
        typeof listing.currency === "string" && listing.currency.trim().length > 0,
    )?.currency;

    if (listedCurrency) {
      setCurrencyInput(listedCurrency);
    }
  }, [currencyInput, listingRows]);

  async function runTransaction(
    action: "list" | "offer" | "cancel",
    executor: () => Promise<{ transaction_hash: string }>,
  ) {
    if (!account) {
      setTxStatus({
        tone: "error",
        message: "Connect wallet before submitting transactions.",
      });
      return;
    }

    setPendingAction(action);
    setTxStatus({ tone: "idle", message: "" });

    try {
      const result = await executor();
      setTxStatus({
        tone: "success",
        message: `Submitted ${action} transaction: ${result.transaction_hash}`,
      });
      await Promise.all([listingQuery.refetch(), detailQuery.refetch()]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transaction failed.";
      setTxStatus({ tone: "error", message });
    } finally {
      setPendingAction(null);
    }
  }

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Listings</h2>
          <div className="flex items-center gap-2">
            <Button
              disabled={!cheapestListing}
              onClick={() => {
                if (!token || !cheapestListing) {
                  return;
                }

                addItem(
                  cartItemFromTokenListing(token, address, cheapestListing, projectId),
                );
              }}
              size="sm"
              type="button"
            >
              Add cheapest to cart
            </Button>
            <Button
              onClick={() => setVerifyOwnership((current) => !current)}
              size="sm"
              type="button"
              variant="outline"
            >
              {verifyOwnership ? "Ownership verified" : "Ownership unverified"}
            </Button>
            <Button
              disabled={listingQuery.isFetching}
              onClick={() => {
                void listingQuery.refetch();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Refresh listings
            </Button>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="space-y-3 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label="Listing price"
                onChange={(event) => setPriceInput(event.target.value)}
                placeholder="Price"
                value={priceInput}
              />
              <Input
                aria-label="Quantity"
                onChange={(event) => setQuantityInput(event.target.value)}
                placeholder="Quantity"
                value={quantityInput}
              />
              <Input
                aria-label="Currency"
                onChange={(event) => setCurrencyInput(event.target.value)}
                placeholder="Currency"
                value={currencyInput}
              />
              <Input
                aria-label="Expiration"
                onChange={(event) => setExpirationInput(event.target.value)}
                placeholder="Expiration"
                value={expirationInput}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!isConnected || pendingAction !== null}
                onClick={() => {
                  void runTransaction("list", () =>
                    marketplaceProvider.marketplace.list(
                      account!,
                      address,
                      tokenId,
                      quantityInput,
                      priceInput,
                      currencyInput,
                      expirationInput,
                      true,
                    ),
                  );
                }}
                size="sm"
                type="button"
              >
                List token
              </Button>
              <Button
                disabled={!isConnected || pendingAction !== null}
                onClick={() => {
                  void runTransaction("offer", () =>
                    marketplaceProvider.marketplace.offer(
                      account!,
                      address,
                      tokenId,
                      quantityInput,
                      priceInput,
                      currencyInput,
                      expirationInput,
                    ),
                  );
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Make offer
              </Button>
              <Button
                disabled={!isConnected || pendingAction !== null || !ownListing}
                onClick={() => {
                  if (!ownListing) {
                    setTxStatus({
                      tone: "error",
                      message: "No owned listing available to cancel.",
                    });
                    return;
                  }

                  void runTransaction("cancel", () =>
                    marketplaceProvider.marketplace.cancel(
                      account!,
                      ownListing.id,
                      address,
                      tokenId,
                    ),
                  );
                }}
                size="sm"
                type="button"
                variant="destructive"
              >
                Cancel mine
              </Button>
            </div>

            {!isConnected ? (
              <p className="text-xs text-muted-foreground">
                Connect wallet to transact.
              </p>
            ) : null}

            {txStatus.message ? (
              <p
                className={
                  txStatus.tone === "error"
                    ? "text-xs text-destructive"
                    : "text-xs text-primary"
                }
              >
                {txStatus.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {listingQuery.isError ? (
          <p className="text-sm text-destructive">Listings failed to load.</p>
        ) : null}

        {listingQuery.isFetching ? (
          <Badge variant="outline">Refreshing...</Badge>
        ) : null}

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
